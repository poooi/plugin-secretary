import { createSelector } from 'reselect'
import _, { get, keyBy } from 'lodash'
import { toRomaji } from 'wanakana'

const $shipsSelector = state => get(state, ['const', '$ships'], {})
const graphsSelector = state => get(state, ['const', '$graphs']) || keyBy(get(state, ['const', '$shipgraph']), 'api_id')
const fleetsSelector = state => get(state, ['info', 'fleets'], [])
const shipsSelector = state => get(state, ['info', 'ships'], {})

const ourShipsSelector = createSelector(
  [
    $shipsSelector,
  ], ships => _(ships)
    .pickBy(({ api_sortno }) => Boolean(api_sortno))
    .value()
)

export const shipDataSelector = createSelector(
  [
    ourShipsSelector,
    graphsSelector,
  ], (ships, graphs) => _(ships)
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

const beforeShipMapSelector = createSelector(
  [
    ourShipsSelector,
  ], $ships => _($ships)
    .filter(ship => +(ship.api_aftershipid || 0) > 0)
    .map(ship => ([ship.api_aftershipid, ship.api_id]))
    .fromPairs()
    .value()
)

// the chain starts from each ship, thus incomplete if the ship is not the starting one
// the adjustedRemodelChainsSelector will return complete chains for all ships
const remodelChainsSelector = createSelector(
  [
    ourShipsSelector,
  ], $ships => _($ships)
    .mapValues(({ api_id: shipId }) => {
      let current = $ships[shipId]
      let next = +(current.api_aftershipid || 0)
      let same = [shipId]
      while (!same.includes(next) && next > 0) {
        same = [...same, next]
        current = $ships[next] || {}
        next = +(current.api_aftershipid || 0)
      }
      return same
    })
    .value()
)

export const uniqueShipIdsSelector = createSelector(
  [
    ourShipsSelector,
    beforeShipMapSelector,
  ], ($ships, beforeShipMap) => _($ships)
    .filter(({ api_id }) => !(api_id in beforeShipMap))
    .map(({ api_id }) => api_id)
    .value()
)

export const shipUniqueMapSelector = createSelector(
  [
    uniqueShipIdsSelector,
    remodelChainsSelector,
  ], (shipIds, chains) => _(shipIds)
    .flatMap(shipId =>
      _(chains[shipId]).map(id => ([id, shipId])).value()
    )
    .fromPairs()
    .value()
)

export const adjustedRemodelChainsSelector = createSelector(
  [
    remodelChainsSelector,
    shipUniqueMapSelector,
  ], (remodelChains, uniqueMap) => _(uniqueMap)
    .mapValues(uniqueId => remodelChains[uniqueId])
    .value()
)
