using Microsoft.Extensions.Options;

namespace RosterMeApi.Services;

public class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ReminderOptions _reminderOptions;
    private readonly ILogger<ReminderBackgroundService> _logger;

    public ReminderBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<ReminderOptions> reminderOptions,
        ILogger<ReminderBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _reminderOptions = reminderOptions.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_reminderOptions.Enabled)
        {
            _logger.LogInformation("Signup reminder service is disabled");
            return;
        }

        var delay = TimeSpan.FromMinutes(_reminderOptions.IntervalMinutes);
        if (delay <= TimeSpan.Zero)
            delay = TimeSpan.FromMinutes(10);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var reminders = scope.ServiceProvider.GetRequiredService<SignupReminderService>();
                var enqueued = await reminders.EnqueueDueRemindersAsync(stoppingToken);
                if (enqueued > 0)
                    _logger.LogInformation("Enqueued {Count} signup reminder(s)", enqueued);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Signup reminder worker encountered an error");
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
