import { createSelector } from 'reselect'
import _, { get, keyBy, each, uniq, flatMap, values } from 'lodash'
import fp from 'lodash/fp'
import { toRomaji } from 'wanakana'
import memoize from 'fast-memoize'

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

const beforeShipMapSelector = createSelector(
  [
    $shipsSelector,
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
    $shipsSelector,
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
      return [shipId, same]
    })
    .value()
)


export const sameShipMapSelector = createSelector(
  [
    $shipsSelector,
    remodelChainsSelector,
  ], ($ships, remodelChains) => {
    const sameMap = _($ships)
      .map(({ api_id }) => remodelChains[api_id])
      .fromPairs()
      .value()

    each(sameMap, ids =>
      each(ids, (id) => {
        sameMap[id] = uniq([...sameMap[id], ...ids, ...flatMap(ids, s => sameMap[s])])
      })
    )
    return sameMap
  })

export const uniqueShipSelector = createSelector(
  [
    sameShipMapSelector,
    $shipsSelector,
    beforeShipMapSelector,
  ], (sameMap, $ships, beforeShipMap) =>
    fp.flow(
      fp.uniqBy(shipIds => Math.min(...shipIds)),
      fp.map(shipIds => _(shipIds).find(id => !(id in beforeShipMap))),
      fp.filter(shipId => Boolean(get($ships, [shipId, 'api_sortno']))), // we only want our girls
    )(values(sameMap))
)

export const shipUniqueMapSelector = createSelector(
  [
    sameShipMapSelector,
    beforeShipMapSelector,
  ], (sameMap, beforeShipMap) => _(sameMap)
    .mapValues(shipIds => _(shipIds).find(id => !(id in beforeShipMap)))
    .pickBy(Boolean)
    .value()
)

export const adjustedRemodelChainsSelector = createSelector(
  [
    remodelChainsSelector,
    shipUniqueMapSelector,
  ], (remodelChains, uniqueMap) => _(uniqueMap)
    .mapValues(uniqueId => remodelChains[uniqueId][1])
    .value()
)
