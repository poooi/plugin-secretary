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
NONCE = Math.floor(Math.random() * SERVERS.length)

zerofill = (n) ->
  pad = "000"
  n = n.toString()
  if n.length < pad.length
    return (pad+n).slice(-pad.length)
  else
    return n

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
      notifySecretary: config.get('plugin.secretary.ship', 0)
      fleetSecretary: null
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
      server = SERVERS[(ship_id + NONCE) % SERVERS.length]
      filename = @state.shipgraph[ship_id]?.api_filename
      return unless server
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
      ship_id = parseInt(e.target.value)
      return unless ship_id != NaN
      # Save secretary config
      @setState
        notifySecretary: ship_id
      config.set('plugin.secretary.ship', ship_id)
      # Update secretary voice
      if ship_id
        @updateNotifyConfig(ship_id)
      else
        @updateNotifyConfig(@state.fleetSecretary)

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
          <h5>通知秘书</h5>
          <hr />
        </div>
        <Grid>
          <Col xs=12>
            <Input type="select" value={@state.notifySecretary} onChange={@handleShipChange}>
              <option key={0} value={0}>当前秘书舰</option>
              {
                for ship, i in @state.ships
                  continue unless ship?.api_sortno
                  <option key={i} value={ship.api_id}>No.{zerofill(ship.api_sortno)} {ship.api_name}</option>
              }
            </Input>
          </Col>
          <Col xs=12>
            <p>当前秘书舰：{ if @state.fleetSecretary then window.$ships[@state.fleetSecretary]?.api_name else "未知" }</p>
          </Col>
        </Grid>
        <div className="divider">
          <h5>通知试听</h5>
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
