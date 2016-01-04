request = require 'request'
{relative, join} = require 'path-extra'
{$, _, $$, React, ReactBootstrap, FontAwesome, ROOT} = window
{Alert, Button, ButtonGroup, Col, Grid, Input, OverlayTrigger, Tooltip} = ReactBootstrap

# i18n
window.i18n.secretary = new(require 'i18n-2')
  locales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW']
  defaultLocale: 'zh-CN'
  directory: join(__dirname, "i18n")
  extension: '.json'
  updateFiles: false
  devMode: false
window.i18n.secretary.setLocale(window.language)
__ = window.i18n.secretary.__.bind(window.i18n.secretary)
__r = window.i18n.resources.__.bind(window.i18n.resources)

# constant
SERVERS = [
  '203.104.209.71',
  '125.6.184.15',
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
  'poi.notify.repair.audio': 6
  'poi.notify.morale.audio': 27
  'plugin.prophet.notify.damagedAudio': 21
}


zerofill = (n) ->
  pad = "000"
  n = n.toString()
  if n.length < pad.length
    return (pad+n).slice(-pad.length)
  else
    return n

SecretaryArea = React.createClass
  getInitialState: ->
    # 0=fleet secretary, -1=disable, 1~*=$ships[]
    notifySecretary: config.get('plugin.secretary.ship', 0)
    fleetSecretary: null
    # Game data
    isLogin: false
    ships: []
    shipgraph: []
  componentDidMount: ->
    window.addEventListener 'game.response', @handleResponse
  componentWillUnmount: ->
    window.removeEventListener 'game.response', @handleResponse

  handleResponse: (e) ->
    {method, path, body, postBody} = e.detail
    switch path
      when '/kcsapi/api_start2'
        # Ships can be owned by player only, sorted by sortno.
        ships = []
        for ship in body.api_mst_ship
          continue unless ship?.api_sortno
          ships[ship.api_sortno] = ship
        shipgraph = []
        for ship in body.api_mst_shipgraph
          shipgraph[ship.api_id] = ship
        @setState
          isLogin: true
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
    filename = @state.shipgraph[ship_id]?.api_filename
    return unless server
    return unless filename
    for key, id of CONFIG
      setConfig(key, "http://#{server}/kcs/sound/kc#{filename}/#{id}.mp3")

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

  handleDisable: ->
    for key, id of CONFIG
      config.set(key, null)
    config.set('plugin.secretary.ship', -1)
    @setState
      notifySecretary: -1

  render: ->
    <div>
      <link rel="stylesheet" href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')} />

      <div className="divider">
        <h5>{__ 'Notification sound'}</h5>
        <hr />
      </div>
      <Grid>
        <Col xs={12}>
        {
          if @state.isLogin
            options = []
            if @state.notifySecretary == -1
              options.push(
                <option key={-1} value={-1}>
                  {__ 'Disabled'}
                </option>
              )
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
            for ship, i in @state.ships
              continue unless ship?.api_sortno
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
      </Grid>

      <div className="divider">
        <h5>{__ 'Test'}</h5>
        <hr />
      </div>
      <Grid>
        <Col xs={12}>
          <Alert bsStyle='warning'>
            {__ "Some ships have no docking voice"}
          </Alert>
        </Col>
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
      </Grid>
      <div className="divider">
        <h5>{__ 'Advanced'}</h5>
        <hr />
      </div>
      <Grid>
        <Col xs={6}>
          <OverlayTrigger placement='top' overlay={
              <Tooltip id="secretary-reset-note">{__ "Reset to default audio poi"}</Tooltip>
            }>
            <Button bsStyle='warning' style={width: '100%'} onClick={@handleDisable}>
              {__ 'Disable'}
            </Button>
          </OverlayTrigger>
        </Col>
      </Grid>

    </div>

module.exports =
  name: 'secretary'
  displayName: [<FontAwesome name='file-audio-o' key={0} />, " #{__ 'Secretary'}"]
  description: __ 'Use secretary voice as notification sound.'
  author: 'Dazzy Ding'
  link: 'https://github.com/yukixz'
  show: true
  priority: 8
  version: '0.0.0'  # See package.json
  reactClass: SecretaryArea
