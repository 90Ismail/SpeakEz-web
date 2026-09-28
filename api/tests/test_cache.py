from app import cache


class FakePipeline:
    def __init__(self, client, transaction):
        self.client = client
        self.transaction = transaction
        self.queued = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def incr(self, key):
        self.queued.append(("incr", key))

    def expire(self, key, ttl, nx=False):
        self.queued.append(("expire", key, ttl, nx))

    async def execute(self):
        self.client.executed.append((self.transaction, list(self.queued)))
        results = []
        for command in self.queued:
            if command[0] == "incr":
                self.client.counts[command[1]] = self.client.counts.get(command[1], 0) + 1
                results.append(self.client.counts[command[1]])
            else:
                results.append(True)
        return results


class FakeRedis:
    """Only supports pipelines, so any command sent outside one fails the test."""

    def __init__(self):
        self.counts = {}
        self.executed = []

    def pipeline(self, transaction=True):
        return FakePipeline(self, transaction)


async def test_incr_with_ttl_sets_count_and_expiry_in_one_transaction(monkeypatch):
    client = FakeRedis()
    monkeypatch.setattr(cache, "get_redis", lambda: client)

    assert await cache.incr_with_ttl("unlock:count:a", 3600) == 1
    assert await cache.incr_with_ttl("unlock:count:a", 3600) == 2

    expected = [("incr", "unlock:count:a"), ("expire", "unlock:count:a", 3600, True)]
    assert client.executed == [(True, expected), (True, expected)]
