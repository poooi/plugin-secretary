{relative, join} = require 'path-extra'
{$, _, $$, React, ReactBootstrap, FontAwesome, ROOT} = window
{Alert, Button, ButtonGroup, Col, Grid, Input, OverlayTrigger, Tooltip, Checkbox, Row} = ReactBootstrap
scheduler = require './scheduler'
{map, pick, keyBy, remove} = require 'lodash'


# i18n
__ = window.i18n["poi-plugin-secretary"].__.bind(window.i18n["poi-plugin-secretary"])
__r = window.i18n.resources.__.bind(window.i18n.resources)


# constant
SERVERS = [
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
  '203.104.209.102'
]
CONFIG = {
  'poi.notify.construction.audio': 5
  'poi.notify.expedition.audio': 7
  'poi.notify.repair.audio': 26
  'poi.notify.morale.audio': 27
  'plugin.prophet.notify.damagedAudio': 21
}
LOCALSTORAGE_DATA_KEY = "secretaryData"


zerofill = (n) ->
  pad = "000"
  n = n.toString()
  if n.length < pad.length
    return (pad+n).slice(-pad.length)
  else
    return n

# vcKey is extracted from Core.swf/common.util.SoundUtil
vcKey = [604825,607300,613847,615318,624009,631856,635451,637218,640529,643036,652687,658008,662481,669598,675545,685034,687703,696444,702593,703894,711191,714166,720579,728970,738675,740918,743009,747240,750347,759846,764051,770064,773457,779858,786843,790526,799973,803260,808441,816028,825381,827516,832463,837868,843091,852548,858315,867580,875771,879698,882759,885564,888837,896168]
convertFilename = (shipId, voiceId) ->
  return (shipId + 7) * 17 * (vcKey[voiceId] - vcKey[voiceId - 1]) % 99173 + 100000

SecretaryArea = React.createClass
  getInitialState: ->
    # Load game data from localStorage.
    try
      {ships, shipgraph} = JSON.parse localStorage[LOCALSTORAGE_DATA_KEY]
    catch
      ships = null
      shipgraph = null

    # 0=fleet secretary, 1~*=$ships[]
    notifySecretary: config.get('plugin.secretary.ship', 0)
    fleetSecretary: null
    # Game data
    ships: ships  # Index by sortno
    shipgraph: shipgraph
    # hourly voice
    enableHourlyVoice: config.get('plugin.secretary.hourly_voice_enable', false)
    hasHourlyVoice: false
  componentDidMount: ->
    window.addEventListener 'game.response', @handleResponse
    window.addEventListener 'secretary.unload', @pluginWillUnload
    @pluginDidLoad()
  componentWillUnmount: ->
    window.removeEventListener 'game.response', @handleResponse
    window.removeEventListener 'secretary.unload', @pluginWillUnload

  pluginDidLoad: ->
    nextHour = new Date()
    nextHour.setHours nextHour.getHours()+1
    nextHour.setMinutes 0
    nextHour.setSeconds 0
    nextHour.setMilliseconds 0
    scheduler.schedule @hourly_notify,
      time: nextHour.getTime()
      interval: 1000 * 60 * 60
      allowImmediate: true
    console.log("scheduled hourly notify, next notify: #{nextHour.toString()}")
    if @state.notifySecretary > 0
      @updateNotifyConfig(@state.notifySecretary)

  pluginWillUnload: ->
    for key, id of CONFIG
      config.set(key)
    scheduler._tasks = []

  handleResponse: (e) ->
    {method, path, body, postBody} = e.detail
    switch path
      when '/kcsapi/api_start2'
        # Ships can be owned by player only, sorted by sortno.
        ships = map body.api_mst_ship, (ship) -> pick(ship, ['api_id', 'api_name', 'api_sortno'])
        remove ships, (ship) -> !ship.api_sortno
        ships = keyBy ships, 'api_sortno'

        shipgraph = map body.api_mst_shipgraph, (ship) -> pick(ship, ['api_id', 'api_filename'])
        shipgraph = keyBy shipgraph, 'api_id'

        localStorage[LOCALSTORAGE_DATA_KEY] = JSON.stringify {ships, shipgraph}
        @setState
          ships: ships
          shipgraph: shipgraph
      when '/kcsapi/api_port/port', '/kcsapi/api_get_member/deck', '/kcsapi/api_req_hensei/change'
        {_decks, _ships} = window
        ship = _decks[0]?.api_ship[0]
        if ship? and ship > 0
          secretary = _ships[ship].api_ship_id
          @setState
            fleetSecretary: secretary
          if @state.notifySecretary == 0
            @updateNotifyConfig(secretary)

  ###
   * Update notification config using audio of ship.
   * Will fallback to default if an audio file is not found,
  ###
  updateNotifyConfig: (ship_id) ->
    setConfig = (key, audio) ->
      config.set(key, audio)
      xhr = new XMLHttpRequest()
      xhr.open("GET", audio)
      xhr.onabort = xhr.onerror = xhr.onload = (e) ->
        config.set(key, null) if @status != 200
      xhr.send()

    return unless ship_id > 0
    admiral_id = parseInt(window._nickNameId) || 0
    server = SERVERS[(ship_id + admiral_id) % SERVERS.length]
    shipFilename = @state.shipgraph?[ship_id]?.api_filename
    return unless server
    return unless shipFilename
    for key, id of CONFIG
      audioFN = convertFilename ship_id, id
      setConfig(key, "http://#{server}/kcs/sound/kc#{shipFilename}/#{audioFN}.mp3")

    {$ships} =  window
    @setState
      hasHourlyVoice: $ships[ship_id]?.api_voicef > 1

  handleShipChange: (e) ->
    ship_id = parseInt(e.target.value)
    return if ship_id is NaN
    # Save secretary config
    config.set('plugin.secretary.ship', ship_id)
    @setState
      notifySecretary: ship_id
    # Update notify config
    if ship_id == 0
      @updateNotifyConfig(@state.fleetSecretary)
    else
      @updateNotifyConfig(ship_id)

  handleAudition: (type) ->
    notify null,
      type: type

  handleSetHourlyVoice: ->
    config.set('plugin.secretary.hourly_voice_enable', !@state.enableHourlyVoice)
    @setState
      enableHourlyVoice: !@state.enableHourlyVoice

  handleHourlyVoiceClick: ->
    @hourly_notify()

  hourly_notify: (time) ->
    # time: epoch time format, because scheduler will pass a current time arg
    return unless config.get('poi.content.muted', false)
    return unless config.get('plugin.secretary.hourly_voice_enable', false)
    return unless @state.hasHourlyVoice
    return unless @state.notifySecretary >= 0

    if arguments.length == 0
      nowHour = new Date().getHours()
    else
      nowHour = new Date(time).getHours()

    if @state.notifySecretary # case for 0
      ship_id = @state.notifySecretary
    else
      ship_id = @state.fleetSecretary

    admiral_id = parseInt(window._nickNameId) || 0
    server = SERVERS[(ship_id + admiral_id) % SERVERS.length]
    shipFilename = @state.shipgraph?[ship_id]?.api_filename
    return unless server
    return unless shipFilename
    audioFN = convertFilename ship_id, (nowHour + 30)
    pad = "00"
    nowHourString = nowHour.toString()
    if nowHourString.length < pad.length
      nowHourString = (pad + nowHourString).slice(-pad.length)
    notify __("It's %s now", "#{nowHourString}00"),
      title: __ 'Hourly Voice'
      audio: "http://#{server}/kcs/sound/kc#{shipFilename}/#{audioFN}.mp3"

  render: ->
    <div id='secretary' className='secretary'>
      <link rel="stylesheet" href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')} />

      <div className="divider">
        <h5>{__ 'Notification secretary'}</h5>
        <hr />
      </div>
      <Grid>
        <Row>
          <Col xs={12}>
          {
            if @state.ships?
              options = []
              options.push(
                <option key={0} value={0}>
                  {__ 'Current secretary'}: {
                    if $ships[@state.fleetSecretary]?
                      __r $ships[@state.fleetSecretary].api_name
                    else
                      __ 'Unknown'
                  }
                </option>
              )
              for i, ship of @state.ships
                continue unless ship?
                options.push(
                  <option key={i} value={ship.api_id}>
                    No.{zerofill ship.api_sortno} {__r ship.api_name}
                  </option>
                )
              <Input type="select" value={@state.notifySecretary} onChange={@handleShipChange}>
                {options}
              </Input>
            else
              <Input type="select" value={0} disabled>
                <option key={0} value={0}>{__ 'Not logged in'}</option>
              </Input>
          }
          </Col>
        </Row>
        <Row>
          <Col xs={12}>
            <Checkbox checked={@state.enableHourlyVoice} onChange={@handleSetHourlyVoice}>
            {__("Play secretary's hourly voice when volume off")}
            </Checkbox>
          </Col>
        </Row>
      </Grid>

      <div className="divider">
        <h5>{__ 'Test'}</h5>
        <hr />
      </div>
      <Grid>
        <Row>
          <Col xs={12}>
            <ButtonGroup style={display: 'flex'}>
              <Button bsStyle={'success'} style={flex: '1'}
                onClick={@handleAudition.bind(this, 'construction')}>{__ 'Construction'}</Button>
              <Button bsStyle={'success'} style={flex: '1'}
                onClick={@handleAudition.bind(this, 'repair')}>{__ 'Docking'}</Button>
              <Button bsStyle={'success'} style={flex: '1'}
                onClick={@handleAudition.bind(this, 'expedition')}>{__ 'Expedition'}</Button>
              <Button bsStyle={'success'} style={flex: '1'}
                onClick={@handleAudition.bind(this, 'morale')}>{__ 'Morale'}</Button>
            </ButtonGroup>
          </Col>
          <Col xs={4}>
            <Button
              style={{width: '100%'}}
              bsStyle = {if @state.hasHourlyVoice and @state.enableHourlyVoice then 'success' else 'info'}
              disabled = {!@state.hasHourlyVoice or !@state.enableHourlyVoice}
              onClick = {@handleHourlyVoiceClick}>
            {__("Hourly Voice")}
            </Button>
          </Col>
        </Row>
      </Grid>
    </div>


module.exports =
  reactClass: SecretaryArea
  pluginWillUnload: ->
    window.dispatchEvent new Event 'secretary.unload'
