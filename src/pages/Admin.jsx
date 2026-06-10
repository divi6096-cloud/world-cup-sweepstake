import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'rift2026'

const STAGE_MAP = {
  GROUP_STAGE: 'group', LAST_16: 'r16', ROUND_OF_16: 'r16',
  QUARTER_FINALS: 'qf', SEMI_FINALS: 'sf',
  FINAL: 'final', '3RD_PLACE_MATCH': 'final',
}
function apiStageToGW(stage, matchday) {
  if (stage === 'GROUP_STAGE') return matchday || 1
  return { LAST_16: 4, ROUND_OF_16: 4, QUARTER_FINALS: 5, SEMI_FINALS: 6, FINAL: 7, '3RD_PLACE_MATCH': 7 }[stage] ?? 4
}

const C = {
  dark: '#0d1f0f', green: '#1a4a20', gold: '#e8b84b', goldDim: '#c49a30',
  cream: '#faf7f0', white: '#ffffff', muted: '#6b7280', border: '#e5e7eb',
}

const ADMIN_TABS = [
  { id: 'participants', label: 'Participants', icon: '👥' },
  { id: 'gameweeks',    label: 'Gameweeks',    icon: '📅' },
  { id: 'matches',      label: 'Matches',      icon: '⚽' },
  { id: 'players',      label: 'Players',      icon: '🌍' },
  { id: 'picks',        label: 'Picks',        icon: '🎯' },
  { id: 'scoring',      label: 'Scoring',      icon: '🏆' },
  { id: 'settings',     label: 'Settings',     icon: '⚙️'  },
]

async function callAPI(endpoint) {
  const res = await fetch(`/.netlify/functions/football-api?endpoint=${encodeURIComponent(endpoint)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

// ── Participants ────────────────────────────────────────────────────────────────
function Participants() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [paid, setPaid] = useState(true)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('participants').select('*').order('name')
    setRows(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!name.trim()) return
    setStatus('')
    const { error } = await supabase.from('participants').insert({ name: name.trim(), paid })
    if (error) { setStatus(`✗ ${error.message}`); return }
    setName(''); setStatus('✓ Added')
    load()
  }

  async function togglePaid(p) {
    await supabase.from('participants').update({ paid: !p.paid }).eq('id', p.id)
    load()
  }

  async function remove(id) {
    if (!confirm('Remove participant?')) return
    await supabase.from('participants').delete().eq('id', id)
    load()
  }

  const paid_count = rows.filter(r => r.paid).length
  const pot = paid_count * (100)

  return (
    <div>
      <h2 style={sh2}>Participants</h2>
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}
          placeholder="Player name" style={sinput} />
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
          <input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)} /> Paid
        </label>
        <button onClick={add} style={sbtn}>Add</button>
        {status && <span style={{ fontSize:13, color: status.startsWith('✓')?'#16a34a':'#dc2626' }}>{status}</span>}
      </div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
        {paid_count} paid · {rows.length - paid_count} free · Pot: R{pot.toLocaleString()}
      </div>
      {loading ? <p style={{ color:C.muted }}>Loading…</p> : (
        <table style={stable}>
          <thead><tr>
            {['Name','Paid','Swap Used',''].map(h => <th key={h} style={sth}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={r.id} style={{ background: i%2===0?'#fff':'#f9fafb' }}>
                <td style={std}>{r.name}</td>
                <td style={std}>
                  <button onClick={()=>togglePaid(r)} style={{ ...sbadge, background:r.paid?'#d1fae5':'#f3f4f6', color:r.paid?'#065f46':'#374151' }}>
                    {r.paid ? '✓ Paid' : 'Free'}
                  </button>
                </td>
                <td style={std}>
                  <span style={{ ...sbadge, background:r.knockout_swap_used?'#fef9c3':'#f3f4f6', color:r.knockout_swap_used?'#854d0e':'#6b7280' }}>
                    {r.knockout_swap_used ? '⚡ Used' : '—'}
                  </span>
                </td>
                <td style={std}>
                  <button onClick={()=>remove(r.id)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:13 }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Gameweeks ────────────────────────────────────────────────────────────────
function Gameweeks() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ week_number:'', label:'', starts_at:'', ends_at:'' })
  const [status, setStatus] = useState('')

  const load = async () => {
    const { data } = await supabase.from('gameweeks').select('*').order('week_number')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setStatus('')
    const { error } = await supabase.from('gameweeks').insert({
      week_number: parseInt(form.week_number),
      label: form.label,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    })
    if (error) { setStatus(`✗ ${error.message}`); return }
    setForm({ week_number:'', label:'', starts_at:'', ends_at:'' })
    setStatus('✓ Gameweek added')
    load()
  }

  async function remove(id) {
    if (!confirm('Delete gameweek?')) return
    await supabase.from('gameweeks').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h2 style={sh2}>Gameweeks</h2>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        {[['week_number','Week #','number'],['label','Label','text'],['starts_at','Starts','datetime-local'],['ends_at','Ends','datetime-local']].map(([k,p,t])=>(
          <input key={k} type={t} placeholder={p} value={form[k]}
            onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{...sinput, width:t==='datetime-local'?180:110}} />
        ))}
        <button onClick={save} style={sbtn}>Add</button>
        {status && <span style={{ fontSize:13, color:status.startsWith('✓')?'#16a34a':'#dc2626' }}>{status}</span>}
      </div>
      <table style={stable}>
        <thead><tr>{['#','Label','Starts','Ends',''].map(h=><th key={h} style={sth}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={r.id} style={{ background:i%2===0?'#fff':'#f9fafb' }}>
              <td style={std}>{r.week_number}</td>
              <td style={std}>{r.label}</td>
              <td style={std}>{r.starts_at ? new Date(r.starts_at).toLocaleString() : '—'}</td>
              <td style={std}>{r.ends_at ? new Date(r.ends_at).toLocaleString() : '—'}</td>
              <td style={std}><button onClick={()=>remove(r.id)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:13 }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Matches ────────────────────────────────────────────────────────────────
function Matches() {
  const [matches, setMatches] = useState([])
  const [gameweeks, setGameweeks] = useState([])
  const [pulling, setPulling] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState('')
  const [editId, setEditId] = useState(null)
  const [editScore, setEditScore] = useState({ home:'', away:'' })

  const load = async () => {
    const [m, g] = await Promise.all([
      supabase.from('matches').select('*').order('match_date'),
      supabase.from('gameweeks').select('*').order('week_number'),
    ])
    if (m.error) console.error('matches load error:', m.error.message)
    setMatches(m.data || [])
    setGameweeks(g.data || [])
  }
  useEffect(() => { load() }, [])

  async function pullMatches() {
    setPulling(true); setStatus('Fetching matches from API…')
    try {
      const data = await callAPI('competitions/WC/matches?season=2026')
      const allMatches = data.matches || []
      if (!allMatches.length) { setStatus('✗ No matches returned'); setPulling(false); return }

      const { data: teams } = await supabase.from('teams').select('id, name, fifa_code, api_id')
      const teamByCode = {}; const teamByName = {}; const teamByApiId = {}
      teams?.forEach(t => {
        teamByCode[t.fifa_code] = t.id
        teamByName[t.name.toLowerCase()] = t.id
        if (t.api_id) teamByApiId[t.api_id] = t.id
      })
      const findTeam = (t) => teamByApiId[t?.id] || teamByCode[t?.tla] || teamByName[t?.name?.toLowerCase()] || null

      const rows = []
      let skipped = 0
      for (const m of allMatches) {
        const gwNum = apiStageToGW(m.stage, m.matchday)
        const gw = gameweeks.find(g => g.week_number === gwNum)
        const homeId = findTeam(m.homeTeam)
        const awayId = findTeam(m.awayTeam)
        if (!homeId || !awayId) { skipped++; continue }
        rows.push({
          // Columns the public app reads:
          home_team: m.homeTeam?.name || m.homeTeam?.shortName || '—',
          away_team: m.awayTeam?.name || m.awayTeam?.shortName || '—',
          // UUID/id columns (used by scoring + app joins):
          gameweek_id: gw?.id || null,
          home_team_id: homeId,
          away_team_id: awayId,
          match_date: m.utcDate,
          // Shared:
          stage: STAGE_MAP[m.stage] || 'group',
          home_score: m.score?.fullTime?.home ?? null,
          away_score: m.score?.fullTime?.away ?? null,
          status: m.status,
          api_match_id: m.id,
        })
      }
      if (!rows.length) {
        setStatus(`✗ 0 matches matched your teams (skipped ${skipped}). Run Sync Teams first so teams have api_id, or check team names match.`)
        setPulling(false)
        return
      }
      const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'api_match_id' })
      if (error) throw new Error(error.message)
      await load()
      setStatus(`✓ ${rows.length} matches synced${skipped ? ` · ${skipped} skipped (unmatched teams)` : ''}`)
    } catch(e) { setStatus(`✗ ${e.message}`) }
    setPulling(false)
  }

  async function fullSync() {
    setSyncing(true); setStatus('Full sync: fetching matches + scorers…')
    try {
      const data = await callAPI('competitions/WC/matches?season=2026&status=FINISHED')
      const finished = data.matches || []
      setStatus(`Syncing ${finished.length} finished matches…`)

      const { data: teams } = await supabase.from('teams').select('id, name, fifa_code, api_id')
      const teamByCode = {}; const teamByName = {}; const teamByApiId = {}
      teams?.forEach(t => {
        teamByCode[t.fifa_code] = t.id
        teamByName[t.name.toLowerCase()] = t.id
        if (t.api_id) teamByApiId[t.api_id] = t.id
      })
      const findTeam = (t) => teamByApiId[t.id] || teamByCode[t.tla] || teamByName[t.name?.toLowerCase()] || null

      for (let i = 0; i < finished.length; i++) {
        const m = finished[i]
        setStatus(`Syncing match ${i+1}/${finished.length}: ${m.homeTeam?.name} vs ${m.awayTeam?.name}`)
        const homeId = findTeam(m.homeTeam); const awayId = findTeam(m.awayTeam)
        if (!homeId || !awayId) continue

        const gwNum = apiStageToGW(m.stage, m.matchday)
        const gw = (await supabase.from('gameweeks').select('id').eq('week_number', gwNum).single()).data

        await supabase.from('matches').upsert({
          api_match_id: m.id,
          home_team: m.homeTeam?.name || m.homeTeam?.shortName || '—',
          away_team: m.awayTeam?.name || m.awayTeam?.shortName || '—',
          gameweek_id: gw?.id || null,
          home_team_id: homeId,
          away_team_id: awayId,
          match_date: m.utcDate,
          stage: STAGE_MAP[m.stage] || 'group',
          home_score: m.score?.fullTime?.home ?? null,
          away_score: m.score?.fullTime?.away ?? null,
          status: m.status,
        }, { onConflict: 'api_match_id' })

        // Sync scorers
        try {
          const detail = await callAPI(`matches/${m.id}`)
          const goals = detail.goals || []
          for (const g of goals) {
            if (!g.scorer?.id || g.type === 'OWN_GOAL') continue
            const scorerTeamId = g.team?.id ? teamByApiId[g.team.id] : null
            if (!scorerTeamId) continue
            const { data: player } = await supabase.from('players').select('id').eq('id', g.scorer.id).single()
            if (!player) continue
            const { data: match } = await supabase.from('matches').select('id').eq('api_match_id', m.id).single()
            if (!match) continue
            await supabase.from('player_stats').upsert({
              player_id: player.id,
              match_id: match.id,
              goals: 1,
            }, { onConflict: 'player_id,match_id' })
          }
        } catch(_) {}

        if (i < finished.length - 1) await new Promise(r => setTimeout(r, 700))
      }

      await load()
      setStatus(`✓ Full sync complete — ${finished.length} matches processed`)
    } catch(e) { setStatus(`✗ ${e.message}`) }
    setSyncing(false)
  }

  async function saveScore(id) {
    const h = parseInt(editScore.home); const a = parseInt(editScore.away)
    if (isNaN(h) || isNaN(a)) return
    await supabase.from('matches').update({ home_score: h, away_score: a, status: 'FINISHED' }).eq('id', id)
    setEditId(null); load()
  }

  return (
    <div>
      <h2 style={sh2}>Matches</h2>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <button onClick={pullMatches} disabled={pulling} style={sbtn}>
          {pulling ? 'Fetching…' : '📥 Sync Fixtures'}
        </button>
        <button onClick={fullSync} disabled={syncing} style={{ ...sbtn, background:'#16a34a' }}>
          {syncing ? 'Syncing…' : '🔄 Full Sync (Results + Scorers)'}
        </button>
      </div>
      {status && <div style={{ marginBottom:12, fontSize:13, color:status.startsWith('✓')?'#16a34a':status.startsWith('✗')?'#dc2626':'#374151' }}>{status}</div>}
      <table style={stable}>
        <thead><tr>{['Date','Match','Score','Stage','GW','Edit'].map(h=><th key={h} style={sth}>{h}</th>)}</tr></thead>
        <tbody>
          {matches.map((m,i) => (
            <tr key={m.id} style={{ background:i%2===0?'#fff':'#f9fafb' }}>
              <td style={std}>{m.match_date ? new Date(m.match_date).toLocaleDateString() : '—'}</td>
              <td style={std}>{m.home_team || '—'} vs {m.away_team || '—'}</td>
              <td style={std}>
                {editId === m.id ? (
                  <span style={{ display:'flex', gap:4, alignItems:'center' }}>
                    <input value={editScore.home} onChange={e=>setEditScore(s=>({...s,home:e.target.value}))} style={{ width:36, padding:'2px 6px', border:'1px solid #d1d5db', borderRadius:4 }} />
                    <span>–</span>
                    <input value={editScore.away} onChange={e=>setEditScore(s=>({...s,away:e.target.value}))} style={{ width:36, padding:'2px 6px', border:'1px solid #d1d5db', borderRadius:4 }} />
                    <button onClick={()=>saveScore(m.id)} style={{ ...sbtn, padding:'2px 10px', fontSize:12 }}>Save</button>
                    <button onClick={()=>setEditId(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:12 }}>✕</button>
                  </span>
                ) : (
                  <span>{m.home_score ?? '–'} – {m.away_score ?? '–'}</span>
                )}
              </td>
              <td style={std}>{m.stage}</td>
              <td style={std}>{gameweeks.find(g => g.id === m.gameweek_id)?.label || m.stage || '—'}</td>
              <td style={std}>
                <button onClick={()=>{ setEditId(m.id); setEditScore({ home: m.home_score??'', away: m.away_score??'' }) }}
                  style={{ background:'none', border:'none', color:'#1d4ed8', cursor:'pointer', fontSize:13 }}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Players ────────────────────────────────────────────────────────────────
function Players() {
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [pullingTeams, setPullingTeams] = useState(false)
  const [pullingPlayers, setPullingPlayers] = useState(false)
  const [pullTeamsStatus, setPullTeamsStatus] = useState('')
  const [pullPlayersStatus, setPullPlayersStatus] = useState('')

  const load = async () => {
    const [t, p] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('*, teams(name)').order('name'),
    ])
    setTeams(t.data || [])
    setPlayers(p.data || [])
  }
  useEffect(() => { load() }, [])

  async function pullTeams() {
    setPullingTeams(true); setPullTeamsStatus('Fetching teams…')
    try {
      const data = await callAPI('competitions/WC/teams?season=2026')
      const rows = (data.teams || []).map(t => ({
        api_id: t.id,
        name: t.name,
        fifa_code: t.tla || '',
        group_name: null,
      }))
      if (!rows.length) { setPullTeamsStatus('✗ No teams returned.'); setPullingTeams(false); return }
      const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'name' })
      if (error) throw new Error(error.message)
      await load()
      setPullTeamsStatus(`✓ ${rows.length} teams synced — api_id populated.`)
    } catch(e) { setPullTeamsStatus(`✗ ${e.message}`) }
    setPullingTeams(false)
  }

  async function pullPlayers() {
    if (!teams.length) { setPullPlayersStatus('✗ Pull teams first.'); return }
    const teamsWithApiId = teams.filter(t => t.api_id)
    if (!teamsWithApiId.length) {
      setPullPlayersStatus('✗ No api_id on teams — re-run Sync Teams first, then try again.')
      return
    }
    if (!confirm(`Fetch squads for ${teamsWithApiId.length} teams (~${Math.ceil(teamsWithApiId.length * 6.5 / 60)} min). Continue?`)) return

    setPullingPlayers(true); let count = 0; const errors = []
    for (let i = 0; i < teamsWithApiId.length; i++) {
      const team = teamsWithApiId[i]
      setPullPlayersStatus(`Squad ${i+1}/${teamsWithApiId.length}: ${team.name}…`)
      try {
        const data = await callAPI(`teams/${team.api_id}`)
        const squad = data.squad || []
        if (!squad.length) { errors.push(`${team.name} (no squad yet)`); continue }
        const rows = squad.map(p => ({
          id: p.id,                 // football-data integer ID = primary key (matches your schema)
          name: p.name,
          position: p.position || '—',
          team_id: team.id,
        }))
        const { error } = await supabase.from('players').upsert(rows, { onConflict: 'id' })
        if (error) { errors.push(`${team.name} (${error.message})`); continue }
        count += rows.length     // only count rows the DB actually accepted
      } catch(e) { errors.push(`${team.name} (${e.message})`) }
      if (i < teamsWithApiId.length - 1) await new Promise(r => setTimeout(r, 6500))
    }
    await load()
    setPullPlayersStatus(`✓ ${count} players synced.${errors.length ? ` Issues: ${errors.join(', ')}` : ''}`)
    setPullingPlayers(false)
  }

  const teamsWithApiId = teams.filter(t => t.api_id).length

  return (
    <div>
      <h2 style={sh2}>Players</h2>
      <div style={{ background:'#fefce8', border:'1px solid #fde047', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#854d0e' }}>
        ⚠️ Always run <strong>Sync Teams</strong> first — it populates the API integer IDs needed for squad fetches.
        Currently {teamsWithApiId}/{teams.length} teams have api_id.
      </div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:8 }}>
        <button onClick={pullTeams} disabled={pullingTeams} style={sbtn}>
          {pullingTeams ? 'Fetching…' : '🌍 Sync Teams'}
        </button>
        <button onClick={pullPlayers} disabled={pullingPlayers || !teams.length} style={{ ...sbtn, background:'#16a34a' }}>
          {pullingPlayers ? 'Fetching squads…' : '👥 Sync Players'}
        </button>
      </div>
      {pullTeamsStatus && <div style={{ fontSize:13, color:pullTeamsStatus.startsWith('✓')?'#16a34a':'#374151', marginBottom:6 }}>{pullTeamsStatus}</div>}
      {pullPlayersStatus && <div style={{ fontSize:13, color:pullPlayersStatus.startsWith('✓')?'#16a34a':'#374151', whiteSpace:'pre-line', marginBottom:12 }}>{pullPlayersStatus}</div>}
      <p style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{players.length} players across {teams.length} teams</p>
      <table style={stable}>
        <thead><tr>{['Name','Team','Position'].map(h=><th key={h} style={sth}>{h}</th>)}</tr></thead>
        <tbody>
          {players.map((p,i)=>(
            <tr key={p.id} style={{ background:i%2===0?'#fff':'#f9fafb' }}>
              <td style={std}>{p.name}</td>
              <td style={std}>{p.teams?.name || '—'}</td>
              <td style={std}>{p.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Admin Picks ────────────────────────────────────────────────────────────────
function AdminPicks() {
  const [participants, setParticipants] = useState([])
  const [gameweeks, setGameweeks] = useState([])
  const [players, setPlayers] = useState([])
  const [ptRows, setPtRows] = useState([])
  const [picks, setPicks] = useState([])
  const [settings, setSettings] = useState(null)
  const [selectedGw, setSelectedGw] = useState(null)
  const [editPid, setEditPid] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const [p, g, pl, pt, s] = await Promise.all([
      supabase.from('participants').select('id, name, knockout_swap_used').order('name'),
      supabase.from('gameweeks').select('*').order('week_number'),
      supabase.from('players').select('id, name, team_id, teams(name)').order('name'),
      supabase.from('participant_teams').select('participant_id, team_id, pool'),
      supabase.from('settings').select('*').eq('id', 1).single(),
    ])
    setParticipants(p.data || [])
    setGameweeks(g.data || [])
    setPlayers(pl.data || [])
    setPtRows(pt.data || [])
    setSettings(s.data || null)
    const gw = selectedGw || (g.data?.length ? g.data[0].id : null)
    if (gw && !selectedGw) setSelectedGw(gw)
    // Load picks for the currently selected gameweek
    if (gw) {
      const { data: pk } = await supabase
        .from('player_picks')
        .select('participant_id, gameweek_id, player_id')
        .eq('gameweek_id', gw)
      setPicks(pk || [])
    }
  }, [selectedGw])
  useEffect(() => { load() }, [load])

  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  function getMultiplier(participantId, playerId) {
    if (!settings || !playerId) return 1
    const player = players.find(p => p.id === playerId)
    if (!player) return 1
    const pt = ptRows.filter(r => r.participant_id === participantId)
    const match = pt.find(r => r.team_id === player.team_id)
    if (!match) return 1
    const pool = match.pool
    if (pool === 'A') return parseFloat(settings.team_a_multiplier) || 1.5
    if (pool === 'B') return parseFloat(settings.pool_b_team_mult) || 1.5
    if (pool === 'C') return parseFloat(settings.pool_c_team_mult) || 2
    return 1
  }

  async function savePick(participantId, playerId) {
    if (!selectedGw || !playerId) return
    setSaving(true); setStatus('')
    const { error } = await supabase.from('player_picks').upsert(
      { participant_id: participantId, gameweek_id: selectedGw, player_id: playerId },
      { onConflict: 'participant_id,gameweek_id' }
    )
    if (error) { setStatus(`✗ ${error.message}`); setSaving(false); return }
    setStatus('✓ Pick saved'); setEditPid(null); setSearch('')
    load()
  }

  const pickMap = {}
  picks.forEach(pk => { pickMap[pk.participant_id] = pk })

  return (
    <div>
      <h2 style={sh2}>Picks</h2>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <label style={{ fontSize:14, fontWeight:600 }}>Gameweek:</label>
        <select value={selectedGw||''} onChange={e=>setSelectedGw(e.target.value)} style={sselect}>
          {gameweeks.map(g=><option key={g.id} value={g.id}>{g.label || `GW ${g.week_number}`}</option>)}
        </select>
        {status && <span style={{ fontSize:13, color:status.startsWith('✓')?'#16a34a':'#dc2626' }}>{status}</span>}
      </div>
      <table style={stable}>
        <thead><tr>{['Participant','Current Pick','Mult','Swap Used','Action'].map(h=><th key={h} style={sth}>{h}</th>)}</tr></thead>
        <tbody>
          {participants.map((p,i) => {
            const pick = picks.find(pk => pk.participant_id === p.id)
            const mult = pick ? getMultiplier(p.id, pick.player_id) : null
            return (
              <tr key={p.id} style={{ background:i%2===0?'#fff':'#f9fafb' }}>
                <td style={std}>{p.name}</td>
                <td style={std}>{pick ? players.find(pl=>pl.id===pick.player_id)?.name || '—' : <span style={{ color:'#dc2626', fontSize:13 }}>No pick</span>}</td>
                <td style={std}>{mult ? <span style={{ color:'#16a34a', fontWeight:700 }}>{mult}×</span> : '—'}</td>
                <td style={std}>{p.knockout_swap_used ? '⚡ Used' : '—'}</td>
                <td style={std}>
                  {editPid === p.id ? (
                    <span style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                      <input placeholder="Search player…" value={search} onChange={e=>setSearch(e.target.value)}
                        style={{ ...sinput, width:160 }} autoFocus />
                      <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:160, overflowY:'auto', background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, padding:4 }}>
                        {filteredPlayers.slice(0,20).map(pl => {
                          const m = getMultiplier(p.id, pl.id)
                          return (
                            <button key={pl.id} onClick={()=>savePick(p.id, pl.id)} disabled={saving}
                              style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'4px 8px', border:'none', background:'none', cursor:'pointer', fontSize:13, textAlign:'left' }}>
                              <span>{pl.name} <span style={{ color:C.muted, fontSize:11 }}>{pl.teams?.name}</span></span>
                              {m > 1 && <span style={{ color:'#16a34a', fontWeight:700, fontSize:11 }}>{m}×</span>}
                            </button>
                          )
                        })}
                      </div>
                      <button onClick={()=>{ setEditPid(null); setSearch('') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:13 }}>✕</button>
                    </span>
                  ) : (
                    <button onClick={()=>{ setEditPid(p.id); setSearch('') }}
                      style={{ background:'none', border:'1px solid #d1d5db', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:13 }}>
                      Set
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Scoring ────────────────────────────────────────────────────────────────
function Scoring() {
  const [status, setStatus] = useState('')
  const [calculating, setCalculating] = useState(false)

  async function calculateAll() {
    setCalculating(true); setStatus('Loading data…')
    try {
      const [{ data: participants }, { data: gameweeks }, { data: ptRows }, { data: matches },
             { data: playerStats }, { data: picks }, { data: players }, { data: settings }] = await Promise.all([
        supabase.from('participants').select('id, name, paid'),
        supabase.from('gameweeks').select('*'),
        supabase.from('participant_teams').select('participant_id, team_id, pool'),
        supabase.from('matches').select('*').eq('status','FINISHED'),
        supabase.from('player_stats').select('player_id, match_id, goals'),
        supabase.from('player_picks').select('participant_id, gameweek_id, player_id'),
        supabase.from('players').select('id, team_id'),
        supabase.from('settings').select('*').eq('id', 1).single(),
      ])

      const s = settings || {}
      const pts = {
        group_win: parseFloat(s.points_group_win) || 2,
        r16:       parseFloat(s.points_r16)        || 5,
        qf:        parseFloat(s.points_qf)         || 8,
        sf:        parseFloat(s.points_sf)         || 13,
        final:     parseFloat(s.points_final)      || 20,
        goal:      parseFloat(s.points_goal)       || 4,
        draw:      parseFloat(s.points_draw)       || 1,
        team_goal: parseFloat(s.points_team_goal)  || 1,
      }
      const mults = {
        A: parseFloat(s.team_a_multiplier)  || 1.5,
        B: parseFloat(s.pool_b_team_mult)   || 1.5,
        C: parseFloat(s.pool_c_team_mult)   || 2,
      }
      // Pool multiplier for a given team owned by a participant
      const poolMultFor = (myTeams, teamId) => {
        const owned = myTeams.find(r => r.team_id === teamId)
        return owned ? (mults[owned.pool] || 1) : 1
      }

      const scoreRows = []
      for (const p of participants) {
        for (const gw of gameweeks) {
          const gwMatches = matches.filter(m => m.gameweek_id === gw.id)
          const myTeams = ptRows.filter(r => r.participant_id === p.id)
          const myTeamIds = myTeams.map(r => r.team_id)
          const pick = picks.find(pk => pk.participant_id === p.id && pk.gameweek_id === gw.id)

          let team_points = 0
          for (const m of gwMatches) {
            const stageMap = { group: pts.group_win, r16: pts.r16, qf: pts.qf, sf: pts.sf, final: pts.final }
            const stagePts = stageMap[m.stage] || pts.group_win
            const hs = m.home_score ?? 0
            const as = m.away_score ?? 0
            const draw = hs === as
            const ownsHome = myTeamIds.includes(m.home_team_id)
            const ownsAway = myTeamIds.includes(m.away_team_id)

            // Home team owned
            if (ownsHome) {
              const mult = poolMultFor(myTeams, m.home_team_id)
              let raw = 0
              if (draw) raw += pts.draw
              else if (hs > as) raw += stagePts
              raw += hs * pts.team_goal           // points per goal scored
              team_points += raw * mult
            }
            // Away team owned
            if (ownsAway) {
              const mult = poolMultFor(myTeams, m.away_team_id)
              let raw = 0
              if (draw) raw += pts.draw
              else if (as > hs) raw += stagePts
              raw += as * pts.team_goal
              team_points += raw * mult
            }
          }

          let player_points = 0
          if (pick) {
            const myMatchIds = gwMatches.map(m => m.id)
            const gwGoals = playerStats
              .filter(ps => ps.player_id === pick.player_id && myMatchIds.includes(ps.match_id))
              .reduce((a, b) => a + (b.goals || 0), 0)
            // Multiplier based on the pool of the picked player's team (if owned)
            const player = players.find(pl => pl.id === pick.player_id)
            const playerTeamId = player?.team_id
            const mult = playerTeamId ? poolMultFor(myTeams, playerTeamId) : 1
            player_points = gwGoals * pts.goal * mult
          }

          const total = team_points + player_points
          scoreRows.push({
            participant_id: p.id,
            gameweek_id: gw.id,
            team_points,
            player_points,
            total_points: total,
            calculated_at: new Date().toISOString(),
          })
        }
      }

      const { error } = await supabase.from('participant_scores').upsert(
        scoreRows, { onConflict: 'participant_id,gameweek_id' }
      )
      if (error) throw new Error(error.message)
      setStatus(`✓ Scores calculated for ${participants.length} participants across ${gameweeks.length} gameweeks`)
    } catch(e) { setStatus(`✗ ${e.message}`) }
    setCalculating(false)
  }

  return (
    <div>
      <h2 style={sh2}>Scoring</h2>
      <p style={{ color:C.muted, fontSize:14, marginBottom:20 }}>
        Run this after each matchday to recalculate the leaderboard. It reads all finished matches,
        player goals from player_stats, and picks from player_picks.
      </p>
      <button onClick={calculateAll} disabled={calculating} style={{ ...sbtn, padding:'12px 28px', fontSize:15 }}>
        {calculating ? 'Calculating…' : '🏆 Calculate All Scores'}
      </button>
      {status && (
        <div style={{ marginTop:16, padding:'12px 16px', borderRadius:8, fontSize:14,
          background:status.startsWith('✓')?'#d1fae5':'#fee2e2',
          color:status.startsWith('✓')?'#065f46':'#991b1b' }}>
          {status}
        </div>
      )}
    </div>
  )
}

// ── Settings ────────────────────────────────────────────────────────────────
function Settings() {
  const [form, setForm] = useState({})
  const [phase, setPhase] = useState('group')
  const [phaseLoading, setPhaseLoading] = useState(false)
  const [phaseStatus, setPhaseStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) { setForm(data); setPhase(data.phase || 'group') }
    })
  }, [])

  async function save() {
    setSaving(true); setStatus('')
    const { error } = await supabase.from('settings').update(form).eq('id', 1)
    if (error) { setStatus(`✗ ${error.message}`) } else { setStatus('✓ Saved') }
    setSaving(false)
  }

  async function advanceToKnockout() {
    if (!confirm('Advance to Knockout phase?\n\n• Player picks unlock for ONE swap per participant\n• This cannot be undone\n\nProceed?')) return
    setPhaseLoading(true); setPhaseStatus('')
    try {
      const { error } = await supabase.from('settings').update({ phase: 'knockout' }).eq('id', 1)
      if (error) throw new Error(error.message)
      setPhase('knockout'); setForm(f => ({ ...f, phase: 'knockout' }))
      setPhaseStatus('✓ Advanced to Knockout. Picks now unlocked for one swap each.')
    } catch(e) { setPhaseStatus(`✗ ${e.message}`) }
    setPhaseLoading(false)
  }

  const field = (label, key, type='text') => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:4, color:'#374151' }}>{label}</label>
      <input type={type} value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={sinput} />
    </div>
  )

  return (
    <div style={{ maxWidth:560 }}>
      <h2 style={sh2}>Settings</h2>

      {/* ── Phase Control ───────────────────────────── */}
      <div style={{ background:phase==='group'?'#eff6ff':'#f0fdf4', border:`1.5px solid ${phase==='group'?'#bfdbfe':'#86efac'}`, borderRadius:10, padding:'18px 22px', marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Tournament Phase</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:phase==='group'?'#1d4ed8':'#16a34a', color:'#fff', borderRadius:6, padding:'3px 10px', fontSize:13, fontWeight:600 }}>
                {phase==='group' ? '⚽ Group Stage' : '🏆 Knockout'}
              </span>
              <span style={{ fontSize:13, color:'#6b7280' }}>
                {phase==='group' ? 'Picks are locked in' : 'Each participant has 1 swap'}
              </span>
            </div>
          </div>
          {phase==='group' ? (
            <button onClick={advanceToKnockout} disabled={phaseLoading}
              style={{ ...sbtn, background:'#16a34a', opacity:phaseLoading?0.6:1 }}>
              {phaseLoading ? 'Advancing…' : '🏆 Advance to Knockout'}
            </button>
          ) : (
            <span style={{ background:'#dcfce7', color:'#15803d', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600 }}>✓ Active</span>
          )}
        </div>
        {phaseStatus && <div style={{ marginTop:10, fontSize:13, color:phaseStatus.startsWith('✓')?'#15803d':'#dc2626' }}>{phaseStatus}</div>}
      </div>

      {/* ── General ───────────────────────────── */}
      <h3 style={sh3}>General</h3>
      {field('Entry Fee', 'entry_fee', 'number')}
      {field('Currency Symbol', 'currency_symbol')}

      <h3 style={sh3}>Prize Split (%)</h3>
      {field('1st Place %', 'prize_1st', 'number')}
      {field('2nd Place %', 'prize_2nd', 'number')}
      {field('3rd Place %', 'prize_3rd', 'number')}

      <h3 style={sh3}>Points per Stage Win</h3>
      {field('Group Stage Win', 'points_group_win', 'number')}
      {field('Round of 16', 'points_r16', 'number')}
      {field('Quarter-Final', 'points_qf', 'number')}
      {field('Semi-Final', 'points_sf', 'number')}
      {field('Final / 3rd Place', 'points_final', 'number')}

      <h3 style={sh3}>Other Scoring</h3>
      {field('Draw (per owned team)', 'points_draw', 'number')}
      {field('Team Goal (per goal scored)', 'points_team_goal', 'number')}
      {field('Goal (player pick)', 'points_goal', 'number')}

      <h3 style={sh3}>Team Pool Multipliers</h3>
      {field('Pool A multiplier', 'team_a_multiplier', 'number')}
      {field('Pool B multiplier', 'pool_b_team_mult', 'number')}
      {field('Pool C multiplier', 'pool_c_team_mult', 'number')}

      <button onClick={save} disabled={saving} style={{ ...sbtn, marginTop:8 }}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
      {status && <span style={{ marginLeft:12, fontSize:13, color:status.startsWith('✓')?'#16a34a':'#dc2626' }}>{status}</span>}
    </div>
  )
}

// ── Shared styles ────────────────────────────────────────────────────────────
const sh2 = { fontFamily:"'Barlow Condensed', sans-serif", fontSize:22, fontWeight:700, color:C.dark, marginBottom:20, letterSpacing:'0.02em' }
const sh3 = { fontFamily:"'Barlow Condensed', sans-serif", fontSize:16, fontWeight:700, color:C.green, marginBottom:10, marginTop:22, borderBottom:`1px solid ${C.border}`, paddingBottom:6 }
const stable = { width:'100%', borderCollapse:'collapse', fontSize:14 }
const sth = { textAlign:'left', padding:'8px 12px', background:'#1a4a20', color:'#fff', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:'0.05em' }
const std = { padding:'9px 12px', borderBottom:'1px solid #f1f5f9', verticalAlign:'middle' }
const sinput = { padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:14, fontFamily:'inherit', outline:'none', minWidth:120 }
const sbtn = { padding:'8px 18px', background:C.green, color:'#fff', border:'none', borderRadius:7, fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }
const sbadge = { padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, border:'none', cursor:'pointer' }
const sselect = { padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:14, fontFamily:'inherit' }

// ── Password Gate ────────────────────────────────────────────────────────────
function PasswordGate({ children }) {
  const [input, setInput] = useState('')
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('admin_auth') === 'true')
  const [error, setError] = useState('')

  function attempt() {
    if (input === ADMIN_PASSWORD) { sessionStorage.setItem('admin_auth','true'); setUnlocked(true) }
    else { setError('Incorrect password'); setInput('') }
  }

  if (unlocked) return children

  return (
    <div style={{ minHeight:'100vh', background:'#0d1f0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:40, width:320, textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize:36, marginBottom:12 }}>🔐</div>
        <h2 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:24, fontWeight:700, marginBottom:20, color:C.dark }}>Admin Access</h2>
        <input type="password" value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&attempt()}
          placeholder="Password" style={{ ...sinput, width:'100%', boxSizing:'border-box', marginBottom:12 }} />
        {error && <p style={{ color:'#dc2626', fontSize:13, marginBottom:8 }}>{error}</p>}
        <button onClick={attempt} style={{ ...sbtn, width:'100%', padding:12 }}>Enter</button>
      </div>
    </div>
  )
}

// ── Main Admin App ────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('participants')

  return (
    <PasswordGate>
      <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Outfit', sans-serif" }}>
        <header style={{ background:C.dark, padding:'0 20px', position:'sticky', top:0, zIndex:50, boxShadow:'0 2px 12px rgba(0,0,0,0.4)' }}>
          <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0' }}>
              <span style={{ fontSize:22 }}>⚙️</span>
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:20, color:C.gold, letterSpacing:'0.04em' }}>THE RIFT · ADMIN</span>
            </div>
            <Link to="/" style={{ fontSize:13, color:'rgba(255,255,255,0.55)', textDecoration:'none' }}>← Public site</Link>
          </div>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <nav style={{ display:'flex', gap:2, overflowX:'auto', paddingBottom:0 }}>
              {ADMIN_TABS.map(t => {
                const active = tab === t.id
                return (
                  <button key={t.id} onClick={()=>setTab(t.id)}
                    style={{ padding:'10px 14px', border:'none', borderRadius:'8px 8px 0 0',
                      background: active ? C.cream : 'transparent',
                      color: active ? C.dark : 'rgba(255,255,255,0.55)',
                      fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13,
                      letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
                    {t.icon} {t.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </header>
        <main style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px 48px' }}>
          {tab==='participants' && <Participants />}
          {tab==='gameweeks'    && <Gameweeks />}
          {tab==='matches'      && <Matches />}
          {tab==='players'      && <Players />}
          {tab==='picks'        && <AdminPicks />}
          {tab==='scoring'      && <Scoring />}
          {tab==='settings'     && <Settings />}
        </main>
      </div>
    </PasswordGate>
  )
}
