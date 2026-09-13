using System.Threading.RateLimiting;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Resend;
using RosterMeApi.Data;
using RosterMeApi.Endpoints;
using RosterMeApi.Services;
using RosterMeApi.Validation;
using Scalar.AspNetCore;

if (File.Exists(Path.Combine(Directory.GetCurrentDirectory(), ".env")))
    Env.Load();
else if (File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "..", ".env")))
    Env.Load(Path.Combine("..", ".env"));

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsql => npgsql.EnableRetryOnFailure()
    ));

builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<ReminderOptions>(builder.Configuration.GetSection("Reminder"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddResend(options =>
{
    options.ApiToken = builder.Configuration["Resend:ApiKey"] ?? string.Empty;
    options.ThrowExceptions = true;
});
builder.Services.AddScoped<IEmailSender, ResendEmailSender>();
builder.Services.AddScoped<EmailOutboxService>();
builder.Services.AddScoped<SignupReminderService>();
builder.Services.AddHostedService<EmailBackgroundService>();
builder.Services.AddHostedService<ReminderBackgroundService>();

var clerkIssuer = builder.Configuration["Clerk:Issuer"]
    ?? throw new InvalidOperationException("Clerk:Issuer is not configured");

var clerkAuthorizedPartiesRaw = builder.Configuration["Clerk:AuthorizedParties"]
    ?? throw new InvalidOperationException("Clerk:AuthorizedParties is not configured");

var clerkAuthorizedParties = clerkAuthorizedPartiesRaw
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(p => p.TrimEnd('/'))
    .ToArray();

if (clerkAuthorizedParties.Length == 0)
    throw new InvalidOperationException("Clerk:AuthorizedParties must contain at least one party");

foreach (var party in clerkAuthorizedParties)
{
    if (!Uri.TryCreate(party, UriKind.Absolute, out var uri) ||
        (uri.Scheme != "http" && uri.Scheme != "https"))
    {
        throw new InvalidOperationException($"Invalid authorized party URI: '{party}'");
    }
}

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? Array.Empty<string>();

// When Cors:Origins comes from an env var it is a comma-separated string
// (see compose.yaml Cors__Origins); Get<string[]>() silently yields an empty
// array for such values, so fall back to parsing it explicitly.
if (corsOrigins.Length == 0 && builder.Configuration["Cors:Origins"] is { Length: > 0 } rawOrigins)
{
    corsOrigins = rawOrigins
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(p => p.TrimEnd('/'))
        .ToArray();
}

if (corsOrigins.Length == 0)
    throw new InvalidOperationException(
        "Cors:Origins must contain at least one origin. Set the CORS__ORIGINS environment variable (comma-separated) or the Cors:Origins setting in appsettings.json.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = clerkIssuer;
        // NB: MapInboundClaims must stay false. Clerk's JWT uses "sub" as the user
        // identifier, but the default JWT handler remaps "sub" to
        // ClaimTypes.NameIdentifier. Setting this to true would silently break
        // every FindFirst("sub") lookup in AdminEndpoints (line 93) and Program.cs
        // (line 164), effectively bricking all authenticated endpoints.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new()
        {
            ValidateIssuer = true,
            ValidIssuer = clerkIssuer,
            ValidateAudience = false,
            ValidateLifetime = true
        };
        options.Events = new()
        {
            OnTokenValidated = ctx =>
            {
                var azp = ctx.Principal?.FindFirst("azp")?.Value?.TrimEnd('/');
                if (azp is null || !clerkAuthorizedParties.Contains(azp, StringComparer.OrdinalIgnoreCase))
                {
                    ctx.Fail("Unauthorized authorized party.");
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("SuperAdmin", p => p.RequireClaim("role", "superAdmin"));

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>();

builder.Services.AddProblemDetails();

// Integration tests set Testing:DisableRateLimiting=true (via environment
// variable from the test factory) so the suite isn't throttled by the signup
// policy — no test asserts 429, and sequential signup-heavy tests would
// otherwise stall minutes in the limiter queue. Production default: enabled.
var disableRateLimiting = builder.Configuration.GetValue<bool>("Testing:DisableRateLimiting");

if (!disableRateLimiting)
{
    builder.Services.AddRateLimiter(options =>
    {
        options.AddFixedWindowLimiter("signup", cfg =>
        {
            cfg.PermitLimit = 10;
            cfg.Window = TimeSpan.FromMinutes(1);
            cfg.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            cfg.QueueLimit = 2;
        });
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    });
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });
});

builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        var logger = app.Services.GetRequiredService<ILoggerFactory>()
            .CreateLogger("StartupMigration");
        logger.LogCritical(ex, "Database migration failed at startup; exiting.");
        throw;
    }
}

app.UseCors("AllowFrontend");

app.UseExceptionHandler(eh => eh.Run(async ctx =>
{
    var feature = ctx.Features.Get<IExceptionHandlerFeature>();
    var ex = feature?.Error;

    var (status, title) = ex switch
    {
        UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
        KeyNotFoundException => (StatusCodes.Status404NotFound, "Not found"),
        BadHttpRequestException bad => (bad.StatusCode, "Bad request"),
        DbUpdateException dbEx when DbConflictDetector.IsConflict(dbEx) => (StatusCodes.Status409Conflict, "Database conflict"),
        DbUpdateException dbEx when DbConflictDetector.IsClientReferenceError(dbEx) => (StatusCodes.Status400BadRequest, "Bad request"),
        DbUpdateException => (StatusCodes.Status500InternalServerError, "Server error"),
        _ => (StatusCodes.Status500InternalServerError, "Server error")
    };

    var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>()
        .CreateLogger("GlobalExceptionHandler");
    if (status == StatusCodes.Status500InternalServerError)
        logger.LogError(ex, "Unhandled exception");
    else
        logger.LogWarning(ex, "Request failed with {Status}", status);

    ctx.Response.StatusCode = status;
    ctx.Response.ContentType = "application/problem+json";
    await ctx.Response.WriteAsJsonAsync(new ProblemDetails
    {
        Status = status,
        Title = title,
        Type = status switch
        {
            StatusCodes.Status400BadRequest => "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            StatusCodes.Status401Unauthorized => "https://tools.ietf.org/html/rfc9110#section-15.5.2",
            StatusCodes.Status404NotFound => "https://tools.ietf.org/html/rfc9110#section-15.5.5",
            StatusCodes.Status409Conflict => "https://tools.ietf.org/html/rfc9110#section-15.5.10",
            StatusCodes.Status500InternalServerError => "https://tools.ietf.org/html/rfc9110#section-15.6.1",
            _ => "about:blank"
        },
        Instance = ctx.Request.Path
    });
}));

app.MapHealthChecks("/health");

if (!disableRateLimiting)
{
    app.UseRateLimiter();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapScalarApiReference();

app.MapAdminEndpoints();
app.MapPublicEndpoints();
app.MapSuperAdminEndpoints();

app.Run();

// Required by WebApplicationFactory<Program> in the test project.
// The partial class gives the compiler a hook to surface the
// auto-generated entry-point class so integration tests can bootstrap it.
public partial class Program { }
