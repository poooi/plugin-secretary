import React, { useState, useEffect, useCallback, useRef } from 'react'
import propTypes from 'prop-types'
import { Button, Classes, InputGroup, Intent, Tab, Tabs, Tag } from '@blueprintjs/core'
import { useSelector } from 'react-redux'
import cls from 'classnames'
import _, { values, padStart, map } from 'lodash'
import Fuse from 'fuse.js'
import FA from 'react-fontawesome'
import { Popover } from 'views/components/etc/overlay'
import styled from 'styled-components'
import { useTranslation } from 'react-i18next'

import { shipDataSelector, shipUniqueMapSelector, adjustedRemodelChainsSelector } from './selectors'

// ship types dated 20170106, beginning with id=1
// const shipTypes = ["海防艦", "駆逐艦", "軽巡洋艦", "重雷装巡洋艦",
// "重巡洋艦", "航空巡洋艦", "軽空母", "戦艦", "戦艦", "航空戦艦", "正規空母",
// "超弩級戦艦", "潜水艦", "潜水空母", "補給艦", "水上機母艦", "揚陸艦", "装甲空母",
// "工作艦", "潜水母艦", "練習巡洋艦", "補給艦"]
// attention, shipCat uses api_id

export const shipCat = [
  {
    id: [8, 9, 10, 12],
    name: 'BB',
  },
  {
    id: [7, 11, 18],
    name: 'CV',
  },
  {
    id: [5, 6],
    name: 'CA',
  },
  {
    id: [3, 4, 21],
    name: 'CL',
  },
  {
    id: [2],
    name: 'DD',
  },
  {
    id: [13, 14],
    name: 'SS',
  },
  {
    id: [1],
    name: 'DE',
  },
  {
    id: [15, 16, 17, 19, 20, 22],
    name: 'Auxiliary',
  },
]

const catMap = _(shipCat)
  .map(({ name, id }) => [name, id])
  .fromPairs()
  .value()

const searchOptions = [
  {
    name: 'All',
    value: 'all',
  },
  ..._(shipCat)
    .map(({ name }) => ({ name, value: name }))
    .value(),
]

const Wrapper = styled.div`
  .bp5-tab-panel {
    margin-top: 0;
  }
`

const ShipList = styled.ul`
  padding: 0;
  margin: 0;
  height: 30em;
  overflow-y: scroll;
  width: 20em;

  span {
    cursor: pointer;
  }
`

const ShipItem = styled.li`
  display: flex;
  padding: 0.5em 1em;
`

const ShipId = styled.span`
  width: 3em;
`

const ShipName = styled.span`
  flex: 1;
`

const FUSE_OPTIONS = {
  keys: ['api_name', 'api_yomi', 'romaji'],
  id: 'api_id',
  shouldSort: true,
}

const Menu = ({ onSelect }) => {
  const { t } = useTranslation('poi-plugin-secretary')
  const ships = useSelector(shipDataSelector)
  const uniqueMap = useSelector(shipUniqueMapSelector)
  const remodelChains = useSelector(adjustedRemodelChainsSelector)

  const [query, setQuery] = useState('')

  const fuseRef = useRef(null)
  if (fuseRef.current === null) {
    fuseRef.current = new Fuse(values(ships), FUSE_OPTIONS)
  }

  useEffect(() => {
    fuseRef.current.setCollection(values(ships))
  }, [ships])

  const handleQueryChange = useCallback(e => {
    setQuery(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setQuery('')
  }, [])

  const handleSelect = useCallback(
    id => () => {
      onSelect(id)
    },
    [onSelect],
  )

  const handleConfirmCustom = useCallback(() => {
    onSelect(0)
  }, [onSelect])

  const filtered = _.map(fuseRef.current.search(query), ({ item }) => item.api_id)

  return (
    <Wrapper>
      <InputGroup
        value={query}
        placeholder={t('Search')}
        onChange={handleQueryChange}
        rightElement={
          <Button minimal onClick={handleClear} intent={Intent.WARNING}>
            <FA name="times" />
          </Button>
        }
      />

      <Tabs vertical id="ship-selection" renderActiveTabPanelOnly>
        {map(searchOptions, ({ name, value: type }) => (
          <Tab
            key={type}
            id={type}
            title={t(name)}
            panel={
              <ShipList className="ship-info-scrollable">
                {_(ships)
                  .filter(
                    ship => !catMap[type] || (catMap[type] || []).includes(ship.api_stype),
                  )
                  .filter(ship => !query || (filtered || []).includes(ship.api_id))
                  .sortBy([
                    ship => (filtered || []).indexOf(ship.api_id),
                    ship => ship.api_stype,
                    ship => ship.api_ctype,
                    ship => uniqueMap[ship.api_id],
                    ship => (remodelChains[ship.api_id] || []).indexOf(ship.api_id),
                  ])
                  .map(ship => (
                    <ShipItem
                      className={cls(Classes.POPOVER_DISMISS, Classes.MENU_ITEM)}
                      key={ship.api_id}
                      onClick={handleSelect(ship.api_id)}
                    >
                      <ShipId>{padStart(ship.api_sortno, 4, '0')}</ShipId>
                      <ShipName>{window.i18n.resources.__(ship.api_name || '')}</ShipName>
                      {ship.api_voicef > 1 && (
                        <Tag intent={Intent.PRIMARY}>
                          <FA name="clock-o" />
                        </Tag>
                      )}
                    </ShipItem>
                  ))
                  .value()}
              </ShipList>
            }
          />
        ))}
        <Tabs.Expander />
        <Button
          onClick={handleConfirmCustom}
          minimal
          className={cls(Classes.POPOVER_DISMISS, Classes.TAB)}
        >
          {t('Current secretary')}
        </Button>
      </Tabs>
    </Wrapper>
  )
}

Menu.propTypes = {
  onSelect: propTypes.func.isRequired,
}

const ShipDropdown = ({ onSelect }) => (
  <Popover
    hasBackdrop
    content={
      <Menu onSelect={onSelect} />
    }>
    <Button minimal>
      <FA name="list" />
    </Button>
  </Popover>
)

ShipDropdown.propTypes = {
  onSelect: propTypes.func.isRequired,
}

export default ShipDropdown
