{$, _, $$, React, ReactBootstrap, FontAwesome, ROOT} = window
{Grid, Col, Input, Button} = ReactBootstrap
{relative, join} = require 'path-extra'

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

module.exports =
  name: 'secretary'
  displayName: [<FontAwesome name='file-audio-o' key={0} />, ' 秘书通知']
  description: '秘书舰通知语音'
  author: 'Dazzy Ding'
  link: 'https://github.com/dazzyd'
  show: true
  priority: 8
  version: '0.1.2'
  reactClass: React.createClass
    getInitialState: ->
      secretary: config.get('plugin.secretary.ship')
      ships: []   # Contains ship id < 500 only.
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
          # Contains ship id < 500, sorted by sortno.
          ships = []
          for ship in body.api_mst_ship
            if ship.api_id < 500
              ships[ship.api_sortno] = ship
          shipgraph = []
          shipgraph[ship.api_id] = ship for ship in body.api_mst_shipgraph
          @setState
            ships: ships
            shipgraph: shipgraph
        when '/kcsapi/api_port/port', '/kcsapi/api_get_member/deck', '/kcsapi/api_req_hensei/change'
          if @state.secretary == null
            @updateNotifyConfig(@state.secretary)

    ###*
     * Update notification config using audio of ship
     * @param {number} ship id in window.$ships
     ###
    updateNotifyConfig: (ship_id) ->
      server = SERVERS[Math.floor(Math.random() * SERVERS.length)];
      return unless server

      # ship_id null represents using flagship from fleet 1
      if not ship_id
        {_decks, _ships} = window
        ship = _decks[0]?.api_ship[0]
        if ship and ship > 0
          ship_id = _ships[ship].api_ship_id

      filename = @state.shipgraph[ship_id]?.api_filename
      return unless filename
      audio_constr = "http://#{server}/kcs/sound/kc#{filename}/5.mp3"
      audio_expedi = "http://#{server}/kcs/sound/kc#{filename}/7.mp3"
      audio_repair = "http://#{server}/kcs/sound/kc#{filename}/6.mp3"
      # audio_morale = ""   # Which audio should we use?
      config.set('poi.notify.construction.audio', audio_constr)
      config.set('poi.notify.expedition.audio', audio_expedi)
      config.set('poi.notify.repair.audio', audio_repair)
      # config.set('poi.notify.morale.audio', audio_morale)

    handleShipChange: (e) ->
      if e && e.target.value != @state.secretary
        ship = e.target.value
        @setState
          secretary: ship
        config.set('plugin.secretary.ship', ship)
        @updateNotifyConfig(ship)

    handleAudition: (type) ->
      audio = null
      switch type
        when 'construction'
          audio = config.get('poi.notify.construction.audio')
        when 'expedition'
          audio = config.get('poi.notify.expedition.audio')
        when 'repair'
          audio = config.get('poi.notify.repair.audio')
      if audio
        sound = new Audio(audio)
        sound.play()

    render: ->
      <div>
        <link rel="stylesheet" href={join(relative(ROOT, __dirname), 'assets', 'secretary.css')} />
        <div className="divider">
          <h5>秘书舰</h5>
          <hr />
        </div>
        <Grid>
          <Col xs=12>
            <Input type="select" value={@state.secretary} onChange={@handleShipChange}>
              <option key={0} value={null}>当前秘书舰</option>
              {
                for ship, i in @state.ships
                  continue unless ship?
                  <option key={i + 1} value={ship.api_id}>No.{ship.api_sortno} {ship.api_name}</option>
              }
            </Input>
          </Col>
        </Grid>
        <div className="divider">
          <h5>试听</h5>
          <hr />
        </div>
        <Grid>
          <Col xs=4>
            <Button bsStyle='danger' style={width: '100%'} onClick={@handleAudition.bind(this, 'construction')}>建造</Button>
          </Col>
          <Col xs=4>
            <Button bsStyle='warning' style={width: '100%'} onClick={@handleAudition.bind(this, 'repair')}>入渠</Button>
          </Col>
          <Col xs=4>
            <Button bsStyle='info' style={width: '100%'} onClick={@handleAudition.bind(this, 'expedition')}>远征</Button>
          </Col>
        </Grid>
      </div>
