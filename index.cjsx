{$, _, $$, React, ReactBootstrap, FontAwesome, ROOT} = window
{Grid, Col, Input, Button, ButtonGroup} = ReactBootstrap
{relative, join} = require 'path-extra'

# i18n
window.i18n.secretary = new(require 'i18n-2')
  locales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW'],
  defaultLocale: 'zh-CN',
  directory: join(__dirname, 'i18n'),
  updateFiles: false,
  indent: "\t",
  extension: '.json'
window.i18n.secretary.setLocale(window.language)
__ = window.i18n.secretary.__.bind(window.i18n.secretary)

if not config.get('plugin.secretary.enable', false)
  for s in ['construction','repair','expedition','morale']
    config.set("poi.notify.#{s}.audio")

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
SERVER_NONCE = Math.floor(Math.random() * SERVERS.length)

zerofill = (n) ->
  pad = "000"
  n = n.toString()
  if n.length < pad.length
    return (pad+n).slice(-pad.length)
  else
    return n

module.exports =
  name: 'secretary'
  displayName: [<FontAwesome name='file-audio-o' key={0} />, " #{__ 'Secretary'}"]
  description: __ 'Use secretary voice as notification sound.'
  author: 'Dazzy Ding'
  link: 'https://github.com/yukixz'
  show: true
  priority: 8
  version: '0.0.0'  # See package.json
  reactClass: React.createClass
    getInitialState: ->
      isLogin: false
      notifySecretary: config.get('plugin.secretary.ship', 0)
      fleetSecretary: null
      # Game data
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
          # Ships array like window.$ships.
          # Contains ship can be owned by player only, sorted by sortno.
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
          if ship and ship > 0
            secretary = _ships[ship].api_ship_id
            @setState
              fleetSecretary: secretary
            if @state.notifySecretary == 0
              @updateNotifyConfig(secretary)

    ###*
     * Update notification config using audio of ship
     * @param {number} ship id in window.$ships
     ###
    updateNotifyConfig: (ship_id) ->
      return unless ship_id > 0
      server = SERVERS[(ship_id + SERVER_NONCE) % SERVERS.length]
      filename = @state.shipgraph[ship_id]?.api_filename
      return unless server
      return unless filename
      audio_constr = "http://#{server}/kcs/sound/kc#{filename}/5.mp3"
      audio_expedi = "http://#{server}/kcs/sound/kc#{filename}/7.mp3"
      audio_repair = "http://#{server}/kcs/sound/kc#{filename}/6.mp3"
      audio_morale = "http://#{server}/kcs/sound/kc#{filename}/27.mp3"
      config.set('poi.notify.construction.audio', audio_constr)
      config.set('poi.notify.expedition.audio', audio_expedi)
      config.set('poi.notify.repair.audio', audio_repair)
      config.set('poi.notify.morale.audio', audio_morale)

    handleShipChange: (e) ->
      ship_id = parseInt(e.target.value)
      return if ship_id is NaN
      # Save secretary config
      @setState
        notifySecretary: ship_id
      config.set('plugin.secretary.ship', ship_id)
      # Update notify config
      if ship_id > 0
        @updateNotifyConfig(ship_id)
      else
        @updateNotifyConfig(@state.fleetSecretary)

    handleAudition: (type) ->
      switch type
        when 'construction'
          notify "Construction notification",
            type: 'construction'
        when 'expedition'
          notify "Expedition notification",
            type: 'expedition'
        when 'repair'
          notify "Repair notification",
            type: 'repair'
        when 'morale'
          notify "Morale notification",
            type: 'morale'

    handleRefresh: () ->
      # Reset server nonce
      SERVER_NONCE = Math.floor(Math.random() * SERVERS.length)
      # Update notify config
      if @state.notifySecretary > 0
        @updateNotifyConfig(@state.notifySecretary)
      else
        @updateNotifyConfig(@state.fleetSecretary)

    render: ->
      <div>
        <link rel="stylesheet" href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')} />

        <div className="divider">
          <h5>{__ 'Notification sound'}</h5>
          <hr />
        </div>
        <Grid>
          <Col xs=12>
          {
            if @state.isLogin
              options = []
              options.push(
                <option key={0} value={0}>
                  {__ 'Current secretary'}: { if @state.fleetSecretary && window.$ships[@state.fleetSecretary]? then window.i18n.resources.__ window.$ships[@state.fleetSecretary].api_name else __ 'Unknown' }
                </option>
              )
              for ship, i in @state.ships
                continue unless ship?.api_sortno
                options.push <option key={i} value={ship.api_id}>No.{zerofill(ship.api_sortno)} {window.i18n.resources.__ ship.api_name}</option>
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
          <Col xs=6>
            <Button bsStyle='warning' style={width: '100%'} onClick={@handleRefresh}>
              {__ 'Reset'}
            </Button>
          </Col>
        </Grid>

      </div>
