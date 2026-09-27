using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RosterMeApi.Tests;

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string TestUserId = "test-admin-1";
    public const string OtherUserId = "test-admin-2";
    public const string UserIdHeader = "X-Test-UserId";
    public const string RoleHeader = "X-Test-Role";
    public const string EmailHeader = "X-Test-Email";
    public const string NameHeader = "X-Test-Name";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Context.Request.Headers.TryGetValue(UserIdHeader, out var values)
            ? values.First()!
            : TestUserId;

        var claims = new List<Claim> { new Claim("sub", userId) };
        if (Context.Request.Headers.TryGetValue(RoleHeader, out var roles))
        {
            var role = roles.First()!;
            if (!string.IsNullOrWhiteSpace(role))
                claims.Add(new Claim("role", role));
        }
        if (Context.Request.Headers.TryGetValue(EmailHeader, out var emails))
        {
            var email = emails.First()!;
            if (!string.IsNullOrWhiteSpace(email))
                claims.Add(new Claim("email", email));
        }
        if (Context.Request.Headers.TryGetValue(NameHeader, out var names))
        {
            var name = names.First()!;
            if (!string.IsNullOrWhiteSpace(name))
                claims.Add(new Claim("name", name));
        }
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
