import { createSelector } from 'reselect'
import _, { get, keyBy } from 'lodash'
import { toRomaji } from 'wanakana'

const $shipsSelector = state => get(state, ['const', '$ships'], {})
const graphsSelector = state => get(state, ['const', '$graphs']) || keyBy(get(state, ['const', '$shipgraph']), 'api_id')
const fleetsSelector = state => get(state, ['info', 'fleets'], [])
const shipsSelector = state => get(state, ['info', 'ships'], {})

export const shipDataSelector = createSelector(
  [
    $shipsSelector,
    graphsSelector,
  ], (ships, graphs) => _(ships)
    .pickBy(ship => Boolean(ship.api_sortno))
    .mapValues(ship => ({
      ...(graphs[ship.api_id] || {}),
      ...ship,
      romaji: toRomaji(ship.api_yomi),
    }))
    .value()
)

export const shipFleetMapSelector = createSelector(
  [
    fleetsSelector,
    shipsSelector,
  ], (fleets, ships) => _(fleets)
    .filter(Boolean)
    .flatMap(
      fleet => _(fleet.api_ship)
        .filter(id => id > 0)
        .map(id => ([get(ships, [id, 'api_ship_id']), fleet.api_id]))
        .value()
    )
    .fromPairs()
    .value()
)

export const fleetShipDataSelector = createSelector(
  [
    fleetsSelector,
    shipsSelector,
    shipDataSelector,
  ], (fleets, ships, shipData) => _(fleets)
    .filter(Boolean)
    .flatMap(
      fleet => _(fleet.api_ship)
        .filter(id => id > 0)
        .map(id => ([id, get(ships, [id, 'api_ship_id'])]))
        .map(([id, shipId]) => ([id, get(shipData, shipId)]))
        .value()
    )
    .fromPairs()
    .value()
)

export const secretaryShipIdSelector = createSelector(
  [
    fleetsSelector,
    shipsSelector,
  ], (fleets, ships) => get(ships, [get(fleets, [0, 'api_ship', 0], 0), 'api_ship_id'], 0)
)
