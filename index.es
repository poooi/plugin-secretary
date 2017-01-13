import { relative, join } from 'path-extra'
import _ from 'lodash'
import React, { Component, PropTypes } from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { Button, ButtonGroup, Col, Grid, Input, Checkbox, Row } from 'react-bootstrap'

import {
  fleetShipsIdSelectorFactory,
  configSelector,
  constSelector,
  shipsSelector,
  createDeepCompareArraySelector,
} from 'views/utils/selectors'

import scheduler from './scheduler'


const { ROOT, notify } = window

// i18n
const __ = window.i18n['poi-plugin-secretary'].__.bind(window.i18n['poi-plugin-secretary'])
const __r = window.i18n.resources.__.bind(window.i18n.resources)


// constants
const SERVERS = [
  '203.104.209.71',
  '203.104.209.87',
  '125.6.184.16',
  '125.6.187.205',
  '125.6.187.229',
  '125.6.187.253',
  '125.6.188.25',
  '203.104.248.135',
  '125.6.189.7',
  '125.6.189.39',
  '125.6.189.71',
  '125.6.189.103',
  '125.6.189.135',
  '125.6.189.167',
  '125.6.189.215',
  '125.6.189.247',
  '203.104.209.23',
  '203.104.209.39',
  '203.104.209.55',
  '203.104.209.102',
]
const CONFIG = {
  'poi.notify.construction.audio': 5,
  'poi.notify.expedition.audio': 7,
  'poi.notify.repair.audio': 26,
  'poi.notify.morale.audio': 27,
  'plugin.prophet.notify.damagedAudio': 21,
}


//
// Selectors
//


const fleetSecretaryIdSelector = createSelector(
  [
    fleetShipsIdSelectorFactory(0),
    shipsSelector,
  ],
  (shipId, ships) => {
    if (shipId && ships && _.get(shipId, 0) && _.get(ships, shipId[0])) {
      return (ships[shipId[0]] || {}).api_ship_id || 0
      // case 0 will be covered in updateNotifyConfig
    }
    return 0
  }
)

const notifySecretaryIdSelector = createSelector(
  [configSelector],
  config => _.get(config, 'plugin.secretary.ship', 0)
)

const enableHoulyVoiceSelector = createSelector(
  [configSelector],
  config => _.get(config, 'plugin.secretary.hourly_voice_enable', false)
)

const availableShipsSelector = createSelector(
  [constSelector],
  ({ $ships }) => {
    const availableShips = _.map($ships, ship => _.pick(ship, ['api_id', 'api_name', 'api_sortno']))
    _.remove(availableShips, ship => !ship.api_sortno)
    return _.keyBy(availableShips, 'api_sortno')
  }
)

const shipgraphSelector = createSelector(
  [constSelector],
  ({ $shipgraph }) => {
    const shipgraph = _.map($shipgraph, ship => _.pick(ship, ['api_id', 'api_filename']))
    return _.keyBy(shipgraph, 'api_id')
  }
)

const hasHourlyVoiceSelector = createSelector(
  [
    constSelector,
    fleetSecretaryIdSelector,
    notifySecretaryIdSelector,
  ],
  ({ $ships, $shipgraph }, fleetSecretaryId, notifySecretaryId) => {
    const shipId = notifySecretaryId || fleetSecretaryId
    const ship = $ships[shipId]
    if (ship != null) {
      return ship.api_voicef > 1
    }
    return false // default value
  }
)


// helper to convert a number into zero-filled string
const zerofill = (n, len) => {
  // n: the number to fill with zeroes
  // len: the length to fill
  const pad = new Array(len).fill(0).join('')
  const str = n.toString()
  if (str.length < len) {
    return (pad + str).slice(-len)
  }
  return str
}


// vcKey is extracted from Core.swf/common.util.SoundUtil
const vcKey = [604825, 607300, 613847, 615318, 624009,
  631856, 635451, 637218, 640529, 643036,
  652687, 658008, 662481, 669598, 675545,
  685034, 687703, 696444, 702593, 703894,
  711191, 714166, 720579, 728970, 738675,
  740918, 743009, 747240, 750347, 759846,
  764051, 770064, 773457, 779858, 786843,
  790526, 799973, 803260, 808441, 816028,
  825381, 827516, 832463, 837868, 843091,
  852548, 858315, 867580, 875771, 879698,
  882759, 885564, 888837, 896168,
]
const convertFilename = (shipId, voiceId) => {
  return (((shipId + 7) * 17 * (vcKey[voiceId] - vcKey[voiceId - 1])) % 99173) + 100000
}

const mapStateToProps = (state, props) => {
  return {
    notifySecretary: notifySecretaryIdSelector(state),
    fleetSecretary: fleetSecretaryIdSelector(state),
    ships: availableShipsSelector(state),
    shipgraph: shipgraphSelector(state),
    enableHourlyVoice: enableHoulyVoiceSelector(state),
    hasHourlyVoice: hasHourlyVoiceSelector(state),
  }
}


class SecretaryArea extends Component {

  componentDidMount() {
    window.addEventListener('secretary.unload', this.pluginWillUnload)
    this.pluginDidLoad()
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.notifySecretary != nextProps.notifySecretary ||
    this.props.fleetSecretary != nextProps.fleetSecretary) {
      const { notifySecretary, fleetSecretary } = nextProps

      this.updateNotifyConfig(notifySecretary || fleetSecretary)
    }
  }

  componentWillUnmount() {
    window.removeEventListener('secretary.unload', this.pluginWillUnload)
  }

  pluginDidLoad = () => {
    const nextHour = new Date()
    nextHour.setHours(nextHour.getHours() + 1)
    nextHour.setMinutes(0)
    nextHour.setSeconds(0)
    nextHour.setMilliseconds(0)
    scheduler.schedule(this.hourly_notify,
      {
        time: nextHour.getTime(),
        interval: 1000 * 60 * 60,
        allowImmediate: true,
      })
  }

  pluginWillUnload = () => {
    _.each(CONFIG, (id, key) => {
      config.set(key)
    })
    scheduler._tasks = []
  }


  // * Update notification config using audio of ship.
  // * Will fallback to default if an audio file is not found,
  updateNotifyConfig = (ship_id) => {
    const setConfig = (key, audio) => {
      config.set(key, audio)
      const xhr = new XMLHttpRequest()
      xhr.open('GET', audio)
      xhr.onabort = xhr.onerror = xhr.onload = (e) => {
        if (xhr.status != 200) config.set(key, null)
      }
      xhr.send()
    }


    if (ship_id <= 0) return
    const admiral_id = parseInt(window._nickNameId) || 0
    const server = SERVERS[(ship_id + admiral_id) % SERVERS.length]
    let shipFilename
    if (this.props.shipgraph[ship_id] != null) {
      shipFilename = this.props.shipgraph[ship_id].api_filename
    }
    if (!server) return
    if (!shipFilename) return
    _.each(CONFIG, (id, key) => {
      const audioFN = convertFilename(ship_id, id)
      if (Number.isNaN(audioFN)) return
      setConfig(key, `http://${server}/kcs/sound/kc${shipFilename}/${audioFN}.mp3`)
    })
  }

  handleShipChange = (e) => {
    const ship_id = parseInt(e.target.value)
    if (Number.isNaN(ship_id)) return
    // Save secretary config
    config.set('plugin.secretary.ship', ship_id)
  }

  handleAudition = type => () => {
    notify(null, { type: type })
  }

  handleSetHourlyVoice = () => {
    config.set('plugin.secretary.hourly_voice_enable', !this.props.enableHourlyVoice)
  }

  handleHourlyVoiceClick = () => {
    this.hourly_notify()
  }

  hourly_notify = (time = 0) => {
    let nowHour = 0
    let ship_id
    // time: epoch time format, because scheduler will pass a current time arg
    if (!config.get('poi.content.muted', false)) return
    if (!this.props.enableHourlyVoice) return
    if (!this.props.hasHourlyVoice) return
    if (this.props.notifySecretary < 0) return

    if (time) {
      nowHour = new Date(time).getHours()
    } else {
      nowHour = new Date().getHours()
    }


    if (this.props.notifySecretary) {
      ship_id = this.props.notifySecretary
    } else {
      ship_id = this.props.fleetSecretary // if it is 0, use fleet secretary
    }

    const admiral_id = parseInt(window._nickNameId) || 0
    const server = SERVERS[(ship_id + admiral_id) % SERVERS.length]
    let shipFilename
    if (this.props.shipgraph[ship_id] != null) {
      shipFilename = this.props.shipgraph[ship_id].api_filename
    }
    if (!server) return
    if (!shipFilename) return
    if (Number.isNaN(nowHour)) return

    const audioFN = convertFilename(ship_id, (nowHour + 30))
    if (Number.isNaN(audioFN)) return

    notify(null, {
      audio: `http://${server}/kcs/sound/kc${shipFilename}/${audioFN}.mp3`,
    })
  }

  renderOptions = () => {
    const { ships, fleetSecretary } = this.props
    const currentSecretary = _.find(ships, ship => ship.api_id == fleetSecretary)
    if (ships != null) {
      const options = []
      options.push(
        <option key={0} value={0}>
          {__('Current secretary')}: {
            currentSecretary ? __r(currentSecretary.api_name) : __('Unknown')
          }
        </option>
      )
      _.each(ships, (ship, i) => {
        if (ship) {
          options.push(
            <option key={i} value={ship.api_id}>
              No.{zerofill(ship.api_sortno, 4)} {__r(ship.api_name)}
            </option>)
        }
      })
      return (
        <Input type="select" value={this.props.notifySecretary} onChange={this.handleShipChange}>
          {options}
        </Input>)
    }
    return (
      <Input type="select" value={0} disabled>
        <option key={0} value={0}>{__('Not logged in')}</option>
      </Input>
    )
  }

  render() {
    return (
      <div id="secretary" className="secretary">
        <link rel="stylesheet" href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')} />

        <div className="divider">
          <h5>{__('Notification secretary')}</h5>
          <hr />
        </div>
        <Grid>
          <Row>
            <Col xs={12}>
              {this.renderOptions()}
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <Checkbox checked={this.props.enableHourlyVoice} onChange={this.handleSetHourlyVoice}>
                {__("Play secretary's hourly voice when volume off")}
              </Checkbox>
            </Col>
          </Row>
        </Grid>

        <div className="divider">
          <h5>{__('Test')}</h5>
          <hr />
        </div>
        <Grid>
          <Row>
            <Col xs={12}>
              <ButtonGroup id={'voice-test'}>
                <Button
                  bsStyle={'success'}
                  onClick={this.handleAudition('construction')}
                >{__('Construction')}</Button>
                <Button
                  bsStyle={'success'}
                  onClick={this.handleAudition('repair')}
                >{__('Docking')}</Button>
                <Button
                  bsStyle={'success'}
                  onClick={this.handleAudition('expedition')}
                >{__('Expedition')}</Button>
                <Button
                  bsStyle={'success'}
                  onClick={this.handleAudition('morale')}
                >{__('Morale')}</Button>
              </ButtonGroup>
            </Col>
            <Col xs={4}>
              <Button
                style={{ width: '100%' }}
                bsStyle={this.props.hasHourlyVoice && this.props.enableHourlyVoice ? 'success' : 'info'}
                disabled={!this.props.hasHourlyVoice || !this.props.enableHourlyVoice}
                onClick={this.handleHourlyVoiceClick}
              >
                {__('Hourly Voice')}
              </Button>
            </Col>
          </Row>
        </Grid>
      </div>
    )
  }
}

SecretaryArea.propTypes = {
  notifySecretary: PropTypes.number.isRequired,
  fleetSecretary: PropTypes.number.isRequired,
  ships: PropTypes.shape({
    api_id: PropTypes.number,
    api_name: PropTypes.string,
    api_sortno: PropTypes.number,
  }).isRequired,
  shipgraph: PropTypes.shape({
    api_id: PropTypes.number,
    api_filename: PropTypes.string,
  }).isRequired,
  enableHourlyVoice: PropTypes.bool.isRequired,
  hasHourlyVoice: PropTypes.bool.isRequired,
}

export const pluginWillUnload = () => {
  window.dispatchEvent(new Event('secretary.unload'))
}

export const reactClass = connect(mapStateToProps)(SecretaryArea)
