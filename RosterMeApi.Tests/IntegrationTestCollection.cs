using Xunit;

namespace RosterMeApi.Tests;

// Single shared Postgres container + test host for all integration tests.
// Without this, each test class gets its own IntegrationTestFactory instance
// (its own container + MigrateAsync), and xUnit runs those collections in
// parallel — slow, Docker contention, interleaved logs.
// DisableParallelization keeps DB-backed tests from racing each other.
[CollectionDefinition(Name, DisableParallelization = true)]
public class IntegrationTestCollection : ICollectionFixture<IntegrationTestFactory>
{
    public const string Name = "Integration";
}
