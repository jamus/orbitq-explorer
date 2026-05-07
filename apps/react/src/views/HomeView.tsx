import { useQuery } from '@apollo/client/react'
import { ROCKET_CONFIGS_BY_IDS } from '@orbitq/graphql'
import type { RocketConfigsByIdsQuery, RocketConfigsByIdsVariables } from '@orbitq/graphql'

const SMOKE_TEST_IDS = [164, 121]

export default function HomeView() {
  const { data, loading, error } = useQuery<RocketConfigsByIdsQuery, RocketConfigsByIdsVariables>(
    ROCKET_CONFIGS_BY_IDS,
    { variables: { ids: SMOKE_TEST_IDS } },
  )

  return (
    <div className="bg-orbitq-900 mx-auto w-full max-w-4xl px-6 py-8">
      <section className="border border-orbitq-700 rounded-sm p-6">
        <h2 className="font-mono text-orbitq-600 text-xs uppercase tracking-widest mb-4">Rockets</h2>
        {loading && <p className="font-mono text-orbitq-600 text-sm">Loading…</p>}
        {error && <p className="font-mono text-status-negative text-sm">Error: {error.message}</p>}
        {data && (
          <ul className="divide-y divide-orbitq-700">
            {data.rocketConfigsByIds.map(rocket => (
              <li key={rocket.id} className="py-3 font-mono text-sm text-orbitq-50 first:pt-0 last:pb-0">
                {rocket.fullName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
