using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using RosterlyApi.Data;
using RosterlyApi.Services;
using Xunit;

namespace RosterlyApi.Tests;

public class IntegrationTestFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("rosterly_test")
        .WithUsername("rosterly")
        .WithPassword("rosterly")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Rate limiting is infrastructure behavior, not under test (no test
        // asserts 429): the "signup" policy (10 req/min + queue of 2) would
        // otherwise park every 11th+ signup POST in the queue for up to a
        // full window refill, stalling the suite for minutes. Program.cs
        // skips AddRateLimiter/UseRateLimiter when this is set. It must be a
        // real environment variable: WebApplication.CreateBuilder only reads
        // files/env/args at startup, so ConfigureAppConfiguration in-memory
        // values arrive too late for Program's direct reads. This runs before
        // the deferred test host builds, so the entry point sees it in time.
        // (Test-process scoped; production default stays enabled.)
        Environment.SetEnvironmentVariable("Testing__DisableRateLimiting", "true");

        // NOTE: do NOT call UseEnvironment("Testing") here. Program.cs reads
        // Clerk:Issuer / Cors:Origins directly off builder.Configuration at
        // startup, and those only exist in appsettings.Development.json (the
        // ConfigureAppConfiguration in-memory override below is applied to the
        // host builder too late to satisfy those reads). Keep the default
        // Development environment so appsettings.Development.json loads.

        // Keep `dotnet test` output readable: appsettings.Development.json sets
        // Microsoft.EntityFrameworkCore.Database.Command to Information, so EF
        // logs every SQL statement and buries real output. Category-specific
        // config beats SetMinimumLevel, hence the explicit AddFilter rules
        // (added later = wins). Tests don't assert on logs.
        builder.ConfigureLogging(logging =>
        {
            logging.SetMinimumLevel(LogLevel.Warning);
            logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
            logging.AddFilter("Npgsql", LogLevel.Warning);
        });

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Clerk:Issuer"] = "https://test.clerk.accounts.dev",
                ["Clerk:AuthorizedParties"] = "http://localhost:5173,http://localhost:80,http://localhost",
                // Defense in depth: never let a real Resend token reach the test host.
                ["Resend:ApiKey"] = ""
            });
        });

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();

            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_dbContainer.GetConnectionString()));

            services.Configure<Microsoft.AspNetCore.Authentication.AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = "Test";
                options.DefaultChallengeScheme = "Test";
            });

            services.AddAuthentication("Test")
                .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TestAuthHandler>("Test", null);

            services.AddAuthorization();

            // Tests must never send real emails: stop the outbox/reminder
            // background workers entirely (they poll on a timer and would hit
            // the Resend API, hold DB connections open, and delay host
            // shutdown) and swap the sender for a recording no-op.
            // NOTE: AddHostedService<T> registers ServiceDescriptor with
            // ServiceType IHostedService, so match on that (not just
            // ImplementationType, which is null for factory registrations).
            var backgroundWorkers = services
                .Where(d => d.ServiceType == typeof(IHostedService)
                    || d.ImplementationType == typeof(EmailBackgroundService)
                    || d.ImplementationType == typeof(ReminderBackgroundService))
                .ToList();
            foreach (var descriptor in backgroundWorkers)
                services.Remove(descriptor);

            // Rate limiting is disabled in tests via the
            // Testing__DisableRateLimiting env var (see ConfigureWebHost above):
            // RateLimiterOptions.AddPolicy throws on duplicate names, so the
            // production "signup" policy cannot be overridden from here.
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender, RecordingNoopEmailSender>();

            // Keep the reminder sweep deterministic in tests: individual tests
            // invoke SignupReminderService directly.
            services.Configure<RosterlyApi.Services.ReminderOptions>(o => o.Enabled = false);
        });
    }

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        // `new` hides WebApplicationFactory's ValueTask DisposeAsync, so xUnit
        // calls this overload. It must still tear down the test host first
        // (stops TestServer, BackgroundServices, Npgsql pool) BEFORE killing
        // the Postgres container — otherwise shutdown hangs retrying SQL
        // against a dead container (see EnableRetryOnFailure).
        await base.DisposeAsync();
        await _dbContainer.DisposeAsync();
    }

    /// <summary>
    /// No-op sender so nothing can reach the real email provider from tests.
    /// Outbox rows are still written by EnqueueAsync, which is what the tests assert on.
    /// </summary>
    private sealed class RecordingNoopEmailSender(ILogger<RecordingNoopEmailSender> logger) : IEmailSender
    {
        public Task SendAsync(string to, string subject, string htmlBody, string? textBody = null, EmailAttachment? attachment = null, CancellationToken ct = default)
        {
            logger.LogInformation("[test] email suppressed: to={To} subject={Subject}", to, subject);
            return Task.CompletedTask;
        }
    }
}
