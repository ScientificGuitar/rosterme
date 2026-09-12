using Microsoft.Extensions.Options;

namespace RosterlyApi.Services;

public class EmailBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly EmailOptions _emailOptions;
    private readonly ILogger<EmailBackgroundService> _logger;

    public EmailBackgroundService(IServiceScopeFactory scopeFactory, IOptions<EmailOptions> emailOptions, ILogger<EmailBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _emailOptions = emailOptions.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var delay = TimeSpan.FromSeconds(_emailOptions.PollIntervalSeconds);
        if (delay <= TimeSpan.Zero)
            delay = TimeSpan.FromSeconds(5);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var outbox = scope.ServiceProvider.GetRequiredService<EmailOutboxService>();
                var processed = await outbox.ProcessPendingAsync(stoppingToken);
                if (processed > 0)
                    _logger.LogInformation("Email outbox processed {Count} message(s)", processed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Email outbox worker encountered an error");
            }

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}