using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
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
            // the Resend API) and swap the sender for a recording no-op.
            var backgroundWorkers = services
                .Where(d => d.ImplementationType == typeof(EmailBackgroundService)
                    || d.ImplementationType == typeof(ReminderBackgroundService))
                .ToList();
            foreach (var descriptor in backgroundWorkers)
                services.Remove(descriptor);

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
