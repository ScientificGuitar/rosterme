using System.Net;
using Xunit;

namespace RosterlyApi.Tests;

[Collection(IntegrationTestCollection.Name)]
public class HealthEndpointTests : IDisposable
{
    private readonly HttpClient _client;

    public HealthEndpointTests(IntegrationTestFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public void Dispose() => _client.Dispose();
}
