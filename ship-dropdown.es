import React, { Component, PureComponent } from 'react'
import propTypes from 'prop-types'
import { Dropdown, Button, FormGroup, InputGroup, FormControl, Label } from 'react-bootstrap'
import { connect } from 'react-redux'
import cls from 'classnames'
import _, { values, padStart } from 'lodash'
import Fuse from 'fuse.js'
import { RootCloseWrapper } from 'react-overlays'
import FA from 'react-fontawesome'

import { shipDataSelector, shipUniqueMapSelector, adjustedRemodelChainsSelector } from './selectors'

// ship types dated 20170106, beginning with id=1
// const shipTypes = ["海防艦", "駆逐艦", "軽巡洋艦", "重雷装巡洋艦",
// "重巡洋艦", "航空巡洋艦", "軽空母", "戦艦", "戦艦", "航空戦艦", "正規空母",
// "超弩級戦艦", "潜水艦", "潜水空母", "補給艦", "水上機母艦", "揚陸艦", "装甲空母",
// "工作艦", "潜水母艦", "練習巡洋艦", "補給艦"]
// attention, shipCat uses api_id

export const shipCat = [
  {
    name: 'DD',
    id: [2],
  },
  {
    name: 'CL',
    id: [3, 4, 21],
  },
  {
    name: 'CA',
    id: [5, 6],
  },
  {
    name: 'BB',
    id: [8, 9, 10, 12],
  },
  {
    name: 'CV',
    id: [7, 11, 18],
  },
  {
    name: 'SS',
    id: [13, 14],
  },
  {
    name: 'Others',
    id: [1, 15, 16, 17, 19, 20, 22],
  },
]

const { i18n } = window
const __ = i18n['poi-plugin-secretary'].__.bind(i18n['poi-plugin-secretary'])

const catMap = _(shipCat).map(({ name, id }) => ([name, id])).fromPairs().value()

const searchOptions = [
  {
    name: 'All',
    value: 'all',
  },
  ..._(shipCat).map(({ name }) => ({ name, value: name })).value(),
]

const RadioCheck = ({ options, value: currentValue, onChange }) => (
  <div className="radio-check">
    {
    options.map(({ name, value }) =>
      (
        <div
          key={name}
          role="button"
          tabIndex="0"
          onClick={onChange(value)}
          className={cls('filter-option', {
            checked: currentValue === value,
            dark: window.isDarkTheme,
            light: !window.isDarkTheme,
          })}
        >
          {__(name)}
        </div>
      )
    )
  }
  </div>
)

RadioCheck.propTypes = {
  options: propTypes.arrayOf(propTypes.object),
  value: propTypes.string,
  onChange: propTypes.func,
}

const Menu = connect(
  state => ({
    ships: shipDataSelector(state),
    uniqueMap: shipUniqueMapSelector(state),
    remodelChains: adjustedRemodelChainsSelector(state),
  })
)(class Menu extends Component {
  static propTypes = {
    ships: propTypes.objectOf(propTypes.object).isRequired,
    uniqueMap: propTypes.objectOf(propTypes.number).isRequired,
    remodelChains: propTypes.objectOf(propTypes.array).isRequired,
    open: propTypes.bool.isRequired,
    handleRootClose: propTypes.func.isRequired,
    onSelect: propTypes.func.isRequired,
  }

  constructor(props) {
    super(props)

    const options = {
      keys: ['api_name', 'api_yomi', 'romaji'],
      id: 'api_id',
      shouldSort: true,
    }
    this.fuse = new Fuse(values(props.ships), options)
  }

  state = {
    query: '',
    type: 'all',
  }

  componentWillReceiveProps = (nextProps) => {
    if ((nextProps.open || this.props.open !== nextProps.open) &&
      values(this.props.ships).length !== values(nextProps.ships).length
    ) {
      this.fuse.list = values(nextProps.ships)
    }
  }

  shouldComponentUpdate = nextProps =>
    nextProps.open || this.props.open !== nextProps.open

  handleQueryChange = (e) => {
    this.setState({
      query: e.target.value,
    })
  }

  handleTypeChange = value => async () => {
    await this.setState({
      type: value,
    })
    if (this.selection) {
      this.selection.scrollTop = 0
    }
  }

  handleClear = () => {
    this.setState({
      query: '',
    })
  }

  handleSelect = id => async () => {
    this.props.handleRootClose()
    this.props.onSelect(id)
  }

  handleConfirmCustom = () => {
    this.props.handleRootClose()
    this.props.onSelect(0)
  }

  render() {
    const {
      query, type,
    } = this.state
    const {
      open, handleRootClose, ships, uniqueMap, remodelChains,
    } = this.props

    const filtered = _(this.fuse.search(query)).map(Number).value()
    return (
      <RootCloseWrapper
        disabled={!open}
        onRootClose={handleRootClose}
        event="click"
      >
        <ul className="dropdown-menu pull-right" id="secretary-ship-menu">
          <div>
            <FormGroup>
              <InputGroup>
                <FormControl
                  type="text"
                  value={query}
                  placeholder={__('Search')}
                  onChange={this.handleQueryChange}
                />
                <InputGroup.Button>
                  <Button onClick={this.handleClear} bsStyle="danger">{__('Clear')}</Button>
                  <Button bsStyle="primary" onClick={this.handleConfirmCustom}>{__('Set secretary')}</Button>
                </InputGroup.Button>
              </InputGroup>
            </FormGroup>

            <div className="ship-select">
              <RadioCheck
                options={searchOptions}
                value={type}
                label={__('Ship Type')}
                onChange={this.handleTypeChange}
              />
              <div className="selection" ref={(ref) => { this.selection = ref }}>
                {
                  _(ships)
                  .filter(
                    ship => !catMap[type] || (catMap[type] || []).includes(ship.api_stype)
                  )
                  .filter(
                    ship => !query || (filtered || []).includes(ship.api_id)
                  )
                  .sortBy([
                    ship => (filtered || []).indexOf(ship.api_id),
                    ship => ship.api_stype,
                    ship => ship.api_ctype,
                    ship => uniqueMap[ship.api_id],
                    ship => (remodelChains[ship.api_id] || []).indexOf(ship.api_id),
                  ])
                  .map(
                    ship => (
                      <div
                        className="select-item"
                        role="button"
                        tabIndex="0"
                        key={ship.api_id}
                        onClick={this.handleSelect(ship.api_id)}
                      >
                        {padStart(ship.api_sortno, 4, '0')} {window.i18n.resources.__(ship.api_name || '')}
                        {
                          ship.api_voicef > 1 &&
                          <Label><FA name="clock-o" /></Label>
                        }
                      </div>
                    )
                  )
                  .value()
                }
              </div>
            </div>
          </div>
        </ul>
      </RootCloseWrapper>
    )
  }
})

class ShipDropdown extends PureComponent {
  static propTypes = {
    onSelect: propTypes.func.isRequired,
  }

  constructor(props) {
    super(props)
    this.handleRootClose = this._handleRootClose.bind(this)
  }

  state = {
    open: false,
  }

  handleToggle = (isOpen) => {
    if (isOpen !== this.state.open) {
      this.setState({ open: isOpen })
    }
  }

  _handleRootClose = () => {
    this.setState({ open: false })
  }

  render() {
    const {
      open,
    } = this.state
    const {
      onSelect,
    } = this.props
    return (
      <Dropdown id="secretary-ship" open={open} onToggle={this.handleToggle}>
        <Dropdown.Toggle bsSize="small">
          <FA name="list" />
        </Dropdown.Toggle>
        <Menu bsRole="menu" open={open} onSelect={onSelect} handleRootClose={this.handleRootClose} />
      </Dropdown>
    )
  }
}

export default ShipDropdown
