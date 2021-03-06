import { relative, join } from 'path-extra'
import _, { get, sample } from 'lodash'
import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Button, ButtonGroup, Label, Checkbox } from 'react-bootstrap'
import cls from 'classnames'

import ShipDropdown from './ship-dropdown'
import {
  notifySecretaryIdSelector,
  enableHoulyVoiceSelector,
  shipDataSelector,
  secretaryShipIdSelector,
  adjustedRemodelChainsSelector,
} from './selectors'
import scheduler from './scheduler'

const { ROOT, notify } = window

// i18n
const __ = window.i18n['poi-plugin-secretary'].__.bind(window.i18n['poi-plugin-secretary'])
const __r = window.i18n.resources.__.bind(window.i18n.resources)

// constants
// sorting ip: _.sortBy(Object.keys(servers), _.range(4).map(i => ip => +(ip.split('.')[i])))
const SERVERS = [
  '125.6.184.215',
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
  '203.104.209.71',
  '203.104.209.87',
  '203.104.209.102',
  '203.104.209.134',
  '203.104.209.150',
  '203.104.209.167',
  '203.104.209.183',
  '203.104.248.135',
]

const CONFIG = {
  'poi.notify.construction.audio': 5,
  'poi.notify.expedition.audio': 7,
  'poi.notify.repair.audio': 26,
  'poi.notify.morale.audio': 27,
  'plugin.prophet.notify.damagedAudio': 21,
}

// vcKey is extracted from Core.swf/common.util.SoundUtil
const vcKey = [
  604825,
  607300,
  613847,
  615318,
  624009,
  631856,
  635451,
  637218,
  640529,
  643036,
  652687,
  658008,
  662481,
  669598,
  675545,
  685034,
  687703,
  696444,
  702593,
  703894,
  711191,
  714166,
  720579,
  728970,
  738675,
  740918,
  743009,
  747240,
  750347,
  759846,
  764051,
  770064,
  773457,
  779858,
  786843,
  790526,
  799973,
  803260,
  808441,
  816028,
  825381,
  827516,
  832463,
  837868,
  843091,
  852548,
  858315,
  867580,
  875771,
  879698,
  882759,
  885564,
  888837,
  896168,
]

const convertFilename = (shipId, voiceId) =>
  (((shipId + 7) * 17 * (vcKey[voiceId] - vcKey[voiceId - 1])) % 99173) + 100000

// time: epoch time format, because scheduler will pass a current time arg
const hourlyNotify = (time = 0) => {
  const nowHour = time ? new Date(time).getHours() : new Date().getHours()

  const state = window.getStore()

  const shipData = shipDataSelector(state)
  // if it is 0, use fleet secretary
  const ship = get(shipData, notifySecretaryIdSelector(state) || secretaryShipIdSelector(state))
  if (
    !config.get('poi.content.muted', false) ||
    !enableHoulyVoiceSelector(state) ||
    !ship ||
    ship.api_voicef <= 1
  ) {
    return
  }

  const server = window._serverIp || sample(SERVERS)
  const shipFilename = ship.api_filename
  if (!server || !shipFilename) {
    return
  }

  const audioFN = convertFilename(ship.api_id, nowHour + 30)
  if (Number.isNaN(audioFN)) {
    return
  }

  notify(null, {
    audio: `http://${server}/kcs/sound/kc${shipFilename}/${audioFN}.mp3`,
  })
}

// * Update notification config using audio of ship.
// * Will fallback to default if an audio file is not found,

const setConfig = async (key, audio) => {
  const resp = await fetch(audio)
  if (resp.ok) {
    config.set(key, audio)
  } else {
    config.set(key, null)
  }
}

const updateNotifyConfig = _shipId => {
  if (_shipId < 0) {
    return
  }
  const state = window.getStore()
  const ships = shipDataSelector(state)
  const shipId = _shipId || secretaryShipIdSelector(state)
  const server = window._serverIp || sample(SERVERS)
  const shipFilename = get(ships, [shipId, 'api_filename'])
  if (!server || !shipFilename) {
    return
  }

  _.each(CONFIG, (id, key) => {
    const audioFN = convertFilename(shipId, id)
    if (Number.isNaN(audioFN)) {
      return
    }
    setConfig(key, `http://${server}/kcs/sound/kc${shipFilename}/${audioFN}.mp3`)
  })
}

const SecretaryArea = connect(state => ({
  notifySecretary: notifySecretaryIdSelector(state),
  fleetSecretary: secretaryShipIdSelector(state),
  ships: shipDataSelector(state),
  enableHourlyVoice: enableHoulyVoiceSelector(state),
  remodelChains: adjustedRemodelChainsSelector(state),
}))(
  class SecretaryArea extends PureComponent {
    static propTypes = {
      notifySecretary: PropTypes.number.isRequired,
      fleetSecretary: PropTypes.number.isRequired,
      ships: PropTypes.shape({
        api_id: PropTypes.number,
        api_name: PropTypes.string,
        api_sortno: PropTypes.number,
      }).isRequired,
      enableHourlyVoice: PropTypes.bool.isRequired,
      remodelChains: PropTypes.objectOf(PropTypes.array).isRequired,
    }

    componentDidUpdate = prevProps => {
      if (
        this.props.notifySecretary !== prevProps.notifySecretary ||
        this.props.fleetSecretary !== prevProps.fleetSecretary
      ) {
        const { notifySecretary, fleetSecretary } = this.props

        updateNotifyConfig(notifySecretary || fleetSecretary)
      }
    }

    handleAudition = type => () => {
      notify(null, { type })
    }

    handleSetHourlyVoice = () => {
      config.set('plugin.secretary.hourly_voice_enable', !this.props.enableHourlyVoice)
    }

    handleHourlyVoiceClick = () => {
      hourlyNotify()
    }

    handleSelect = id => {
      config.set('plugin.secretary.ship', id)
    }

    handleAltSelect = id => () => this.handleSelect(id)

    render() {
      const {
        ships,
        fleetSecretary,
        notifySecretary,
        enableHourlyVoice,
        remodelChains,
      } = this.props
      const ship = get(ships, notifySecretary || fleetSecretary, {})
      const chain = get(remodelChains, notifySecretary || fleetSecretary)
      const hasHourlyVoice = get(ship, ['api_voicef']) > 1
      return (
        <div id="secretary" className="secretary">
          <link
            rel="stylesheet"
            href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')}
          />
          <div>
            <div>
              <div className="title">
                <ShipDropdown onSelect={this.handleSelect} />
                <div className="ship-name">
                  {!notifySecretary && (
                    <span style={{ marginRight: '1ex' }}>{__('Current secretary')}</span>
                  )}
                  <span>{__r(ship.api_name || '')}</span>
                  {hasHourlyVoice && <Label>{__('Hourly Voice')}</Label>}
                </div>
              </div>
              <div className="alt-select">
                {_(chain)
                  .map(shipId => (
                    <div
                      key={shipId}
                      tabIndex="0"
                      role="button"
                      className={cls('select-item', { selected: shipId === ship.api_id })}
                      onClick={this.handleAltSelect(shipId)}
                    >
                      {__r(get(ships, [shipId, 'api_name'], ''))}
                    </div>
                  ))
                  .value()}
              </div>
            </div>
            <div>
              <div>
                <Checkbox
                  checked={this.props.enableHourlyVoice}
                  onChange={this.handleSetHourlyVoice}
                >
                  {__("Play secretary's hourly voice when volume off")}
                </Checkbox>
              </div>
            </div>
          </div>

          <div className="divider">
            <h5>{__('Test')}</h5>
            <hr />
          </div>
          <div>
            <div>
              <div>
                <ButtonGroup id="voice-test">
                  <Button bsStyle="success" onClick={this.handleAudition('construction')}>
                    {__('Construction')}
                  </Button>
                  <Button bsStyle="success" onClick={this.handleAudition('repair')}>
                    {__('Docking')}
                  </Button>
                  <Button bsStyle="success" onClick={this.handleAudition('expedition')}>
                    {__('Expedition')}
                  </Button>
                  <Button bsStyle="success" onClick={this.handleAudition('morale')}>
                    {__('Morale')}
                  </Button>
                </ButtonGroup>
              </div>
              <div xs={4}>
                <Button
                  style={{ width: '100%' }}
                  bsStyle={hasHourlyVoice && enableHourlyVoice ? 'success' : 'info'}
                  disabled={!hasHourlyVoice || !enableHourlyVoice}
                  onClick={this.handleHourlyVoiceClick}
                >
                  {__('Hourly Voice')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }
  },
)

export const pluginWillUnload = () => {
  _.each(CONFIG, (id, key) => {
    config.set(key)
  })
  scheduler._tasks = []
}

export const pluginDidLoad = () => {
  const nextHour = new Date()
  nextHour.setHours(nextHour.getHours() + 1)
  nextHour.setMinutes(0)
  nextHour.setSeconds(0)
  nextHour.setMilliseconds(0)
  scheduler.schedule(hourlyNotify, {
    time: nextHour.getTime(),
    interval: 1000 * 60 * 60,
    allowImmediate: true,
  })
  const shipId = config.get('plugin.secretary.ship', 0)
  updateNotifyConfig(shipId)
}

export const reactClass = SecretaryArea
