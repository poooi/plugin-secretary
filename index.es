import {relative, join} from 'path-extra'
const {$, _, $$, ROOT, $ships} = window
import FontAwesome from 'react-fontawesome'
import React, { Component } from 'react'
import {Alert, Button, ButtonGroup, Col, Grid, Input, OverlayTrigger, Tooltip, Checkbox, Row} from 'react-bootstrap'
import scheduler from './scheduler'


// i18n
const __ = window.i18n["poi-plugin-secretary"].__.bind(window.i18n["poi-plugin-secretary"])
const __r = window.i18n.resources.__.bind(window.i18n.resources)


// constant
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
const LOCALSTORAGE_DATA_KEY = "secretaryData"


const zerofill = (n) => {
  let pad = "000"
  n = n.toString()
  if (n.length < pad.length){
    return (pad+n).slice(-pad.length)
  }
  else{
    return n
  }
}


// vcKey is extracted from Core.swf/common.util.SoundUtil
const vcKey = [604825,607300,613847,615318,624009,631856,635451,637218,640529,643036,652687,658008,662481,669598,675545,685034,687703,696444,702593,703894,711191,714166,720579,728970,738675,740918,743009,747240,750347,759846,764051,770064,773457,779858,786843,790526,799973,803260,808441,816028,825381,827516,832463,837868,843091,852548,858315,867580,875771,879698,882759,885564,888837,896168]
const convertFilename = (shipId, voiceId) =>{
  return (shipId + 7) * 17 * (vcKey[voiceId] - vcKey[voiceId - 1]) % 99173 + 100000
}

class SecretaryArea extends Component{
  constructor(props){
    super(props)
    let ships, shipgraph

    try {
      let json = JSON.parse(localStorage[LOCALSTORAGE_DATA_KEY])
      ships = json.ships
      shipgraph = json.shipgraph
    }
    catch (err){
      ships = null
      shipgraph = null
    }

    this.state = {
      // 0=fleet secretary, 1~*=$ships[]
      notifySecretary: config.get('plugin.secretary.ship', 0),
      fleetSecretary: null,

      // Game data
      ships: ships,
      shipgraph: shipgraph,

      // Hourly voice
      enableHourlyVoice: config.get('plugin.secretary.hourly_voice_enable', false),
      hasHourlyVoice: false,
    }

  }

  componentDidMount() {
    window.addEventListener ('game.response', this.handleResponse)
    window.addEventListener ('secretary.unload', this.pluginWillUnload)
    this.pluginDidLoad()
  }

  componentWillUnmount() {
    window.removeEventListener ('game.response', this.handleResponse)
    window.removeEventListener ('secretary.unload', this.pluginWillUnload)
  }

  pluginDidLoad = () =>{
    let nextHour = new Date()
    nextHour.setHours (nextHour.getHours()+1)
    nextHour.setMinutes (0)
    nextHour.setSeconds (0)
    nextHour.setMilliseconds (0)
    scheduler.schedule (this.hourly_notify,
      {
        time: nextHour.getTime(),
        interval: 1000 * 60 * 60,
        allowImmediate: true,
      })
    console.log(`scheduled hourly notify, next notify: ${nextHour.toString()}`)
    if (this.state.notifySecretary > 0){
      this.updateNotifyConfig(this.state.notifySecretary)
    }
  }

  pluginWillUnload = () =>{
    _.each(CONFIG, (id, key) => {
      config.set(key)
    })
    scheduler._tasks = []
  }

  handleResponse = (e) =>{
    console.log("handleResponse")
    let {method, path, body, postBody} = e.detail
    let shipgraph,ships, ship, secretary
    const {_decks, _ships} = window

    switch (path){
    case '/kcsapi/api_start2':
      // Ships can be owned by player only, sorted by sortno.
      ships = _.map(body.api_mst_ship, (ship) => _.pick(ship, ['api_id', 'api_name', 'api_sortno']))
      _.remove(ships, (ship) => !ship.api_sortno)
      ships = _.keyBy(ships, 'api_sortno')

      shipgraph = _.map(body.api_mst_shipgraph, (ship) => _.pick(ship, ['api_id', 'api_filename']))
      shipgraph = _.keyBy(shipgraph, 'api_id')

      localStorage[LOCALSTORAGE_DATA_KEY] = JSON.stringify({ships, shipgraph})
      this.setState({
        ships: ships,
        shipgraph: shipgraph,
      })
      break
    case '/kcsapi/api_port/port':
    case '/kcsapi/api_get_member/deck':
    case '/kcsapi/api_req_hensei/change':

      if(_decks[0] != null){
        ship = _decks[0].api_ship[0]
      }
      if(ship !=null && ship > 0){
        secretary = _ships[ship].api_ship_id
        this.setState({
          fleetSecretary: secretary,
        })
        if (this.state.notifySecretary == 0){
          this.updateNotifyConfig(secretary)
        }
      }
      break
    }
  }

  // * Update notification config using audio of ship.
  // * Will fallback to default if an audio file is not found,
  updateNotifyConfig = (ship_id) => {
    const setConfig = (key, audio) => {
      config.set(key, audio)
      console.log(key, audio)
      let xhr = new XMLHttpRequest()
      xhr.open("GET", audio)
      xhr.onabort = xhr.onerror = xhr.onload = (e) => {
        console.log(xhr)
        if (xhr.status != 200) config.set(key, null)
      }
      xhr.send()
    }


    if (ship_id <=0) return
    let admiral_id = parseInt(window._nickNameId) || 0
    let server = SERVERS[(ship_id + admiral_id) % SERVERS.length]
    let shipFilename
    if (this.state.shipgraph[ship_id] != null){
      shipFilename = this.state.shipgraph[ship_id].api_filename
    }
    console.log(server, shipFilename)
    if (!server) return
    if (!shipFilename) return
    _.each(CONFIG, (id, key) => {
      let audioFN = convertFilename(ship_id, id)
      setConfig(key, `http://${server}/kcs/sound/kc${shipFilename}/${audioFN}.mp3`)
    })

    let ship = $ships[ship_id]
    if (ship !=null){
      this.setState({hasHourlyVoice: ship.api_voicef > 1})
    }
  }

  handleShipChange = (e) => {
    let ship_id = parseInt(e.target.value)
    if (Number.isNaN(ship_id)) return
    // Save secretary config
    config.set('plugin.secretary.ship', ship_id)
    this.setState({notifySecretary: ship_id})
    // Update notify config
    if (ship_id == 0){
      this.updateNotifyConfig(this.state.fleetSecretary)
    }
    else {
      this.updateNotifyConfig(ship_id)
    }
  }

  handleAudition = (type) => {
    notify(null, {type: type})
  }

  handleSetHourlyVoice = () => {
    config.set('plugin.secretary.hourly_voice_enable', !this.state.enableHourlyVoice)
    this.setState({enableHourlyVoice: !this.state.enableHourlyVoice})
  }

  handleHourlyVoiceClick = () => {
    this.hourly_notify()
  }

  hourly_notify = (time) => {
    let nowHour = 0
    let ship_id
    // time: epoch time format, because scheduler will pass a current time arg
    if(!config.get('poi.content.muted', false)) return
    if(!config.get('plugin.secretary.hourly_voice_enable', false)) return
    if(!this.state.hasHourlyVoice) return
    if(this.state.notifySecretary < 0) return

    if (arguments.length == 0) {
      nowHour = new Date().getHours()
    }
    else{
      nowHour = new Date(time).getHours()
    }

    if (this.state.notifySecretary) {
      ship_id = this.state.notifySecretary
    }
    else {
      ship_id = this.state.fleetSecretary // if it is 0, use fleet secretary
    }

    let admiral_id = parseInt(window._nickNameId) || 0
    let server = SERVERS[(ship_id + admiral_id) % SERVERS.length]
    let shipFilename
    if(this.state.shipgraph[ship_id] != null){
      shipFilename = this.state.shipgraph[ship_id].api_filename
    }
    if (!server) return
    if (!shipFilename) return
    let audioFN = convertFilename (ship_id, (nowHour + 30))
    let pad = "00"
    let nowHourString = nowHour.toString()
    if (nowHourString.length < pad.length){
      nowHourString = (pad + nowHourString).slice(-pad.length)
    }
    notify(null, {
      audio: `http://${server}/kcs/sound/kc${shipFilename}/${audioFN}.mp3`
    })
  }

  renderOptions = () => {
    if (this.state.ships != null){
      let options = []
      options.push(
        <option key={0} value={0}>
          {__('Current secretary')}: {
            $ships[this.state.fleetSecretary] ? __r($ships[this.state.fleetSecretary].api_name) : __ ('Unknown')
          }
        </option>
      )
      _.each(this.state.ships, (ship, i) =>{
        if(ship) {
          options.push(
            <option key={i} value={ship.api_id}>
              No.{zerofill(ship.api_sortno)} {__r(ship.api_name)}
            </option>)
        }
      })
      return(
      <Input type="select" value={this.state.notifySecretary} onChange={this.handleShipChange}>
        {options}
      </Input>)
    }
    else {
      return(
        <Input type="select" value={0} disabled>
          <option key={0} value={0}>{__ ('Not logged in')}</option>
        </Input>
      )
    }
  }

  render() {
    return(
      <div id='secretary' className='secretary'>
        <link rel="stylesheet" href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')} />

        <div className="divider">
          <h5>{__ ('Notification secretary')}</h5>
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
              <Checkbox checked={this.state.enableHourlyVoice} onChange={this.handleSetHourlyVoice}>
              {__("Play secretary's hourly voice when volume off")}
              </Checkbox>
            </Col>
          </Row>
        </Grid>

        <div className="divider">
          <h5>{__ ('Test')}</h5>
          <hr />
        </div>
        <Grid>
          <Row>
            <Col xs={12}>
              <ButtonGroup id={'voice-test'}>
                <Button bsStyle={'success'}
                  onClick={this.handleAudition.bind(this, 'construction')}>{__ ('Construction')}</Button>
                <Button bsStyle={'success'}
                  onClick={this.handleAudition.bind(this, 'repair')}>{__ ('Docking')}</Button>
                <Button bsStyle={'success'}
                  onClick={this.handleAudition.bind(this, 'expedition')}>{__ ('Expedition')}</Button>
                <Button bsStyle={'success'}
                  onClick={this.handleAudition.bind(this, 'morale')}>{__ ('Morale')}</Button>
              </ButtonGroup>
            </Col>
            <Col xs={4}>
              <Button
                style={{width: '100%'}}
                bsStyle = {this.state.hasHourlyVoice && this.state.enableHourlyVoice ? 'success' : 'info'}
                disabled = {!this.state.hasHourlyVoice || !this.state.enableHourlyVoice}
                onClick = {this.handleHourlyVoiceClick}>
              {__("Hourly Voice")}
              </Button>
            </Col>
          </Row>
        </Grid>
      </div>
    )
  }
}

export const pluginWillUnload = () =>{
  window.dispatchEvent(new Event('secretary.unload'))
}

export const reactClass = SecretaryArea
