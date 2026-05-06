import { useQuery } from '@apollo/client/react'
import { ROCKET_CONFIGS_BY_IDS } from '@orbitq/graphql'
import type { RocketConfigsByIdsQuery, RocketConfigsByIdsVariables } from '@orbitq/graphql'

const SMOKE_TEST_IDS = [164, 121];

export default function App() {
  const { data, loading, error } = useQuery<RocketConfigsByIdsQuery, RocketConfigsByIdsVariables>(
    ROCKET_CONFIGS_BY_IDS,
    { variables: { ids: SMOKE_TEST_IDS } },
  );

  if (loading) return <p>Loading rockets…</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>OrbitQ Explorer</h1>
      <ul>
        {data?.rocketConfigsByIds.map(r => (
          <li key={r.id}>{r.fullName}</li>
        ))}
      </ul>
    </div>
  )
}
