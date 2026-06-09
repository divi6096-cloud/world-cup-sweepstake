import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  dark: '#0d1f0f', green: '#1a4a20', gold: '#e8b84b', goldDim: '#c49a30',
  cream: '#faf7f0', white: '#ffffff', muted: '#6b7280', border: '#e5e7eb',
}

export default function PickPage() {
  const [participants, setParticipants] = useState([])
  const [gameweeks, setGameweeks]       = useState([])
  const [players, setPlayers]           = useState([])
  const [ptRows, setPtRows]             = useState([])   // participant_teams
  const [settings, setSettings]         = useState(null)

  const [selectedPid, setSelectedPid]   = useState('')
  const [selectedGw, setSelectedGw]     = useState(null)
  const [currentPick, setCurrentPick]   = useState(null) // player_picks row
  const [search, setSearch]             = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveStatus, setSaveStatus]     = useState('')
  const [loading, setLoading]           = useState(true)

  // Phase / swap state
  const [phase, setPhase]                       = useState('group')
  const [knockoutSwapUsed, setKnockoutSwapUsed] = useState(false)

  // ── Load static data once ────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const [p, g, pl, pt, s] = await Promise.all([
        supabase.from('participants').select('id, name, knockout_swap_used').order('name'),
        supabase.from('gameweeks').select('*').order('week_number'),
        supabase.from('players').select('id, name, team_id, teams(name)').order('name'),
        supabase.from('participant_teams').select('participant_id, team_id, pool'),
        supabase.from('settings').select('*').eq('id', 1).single(),
      ])
      setParticipants(p.data || [])
      setPlayers(pl.data || [])
      setPtRows(pt.data || [])
      setSettings(s.data || null)
      setPhase(s.data?.phase || 'group')

      const gws = g.data || []
      setGameweeks(gws)

      // Default to the current / most recent active gameweek
      const now = new Date()
      const active = gws.find(gw =>
        gw.starts_at && new Date(gw.starts_at) <= now &&
        (!gw.ends_at || new Date(gw.ends_at) >= now)
      )
      setSelectedGw(active?.id || gws[gws.length - 1]?.id || null)
      setLoading(false)
    }
    init()
  }, [])

  // ── Reload participant-specific data when pid or gw changes ─────────────
  const loadPick = useCallback(async (pid, gwId) => {
    if (!pid || !gwId) { setCurrentPick(null); return }

    // Swap status for this participant
    const participant = participants.find(p => p.id === pid)
    setKnockoutSwapUsed(participant?.knockout_swap_used || false)

    // Current pick
    const { data } = await supabase
      .from('player_picks')
      .select('id, player_id, players(name, teams(name))')
      .eq('participant_id', pid)
      .eq('gameweek_id', gwId)
      .maybeSingle()
    setCurrentPick(data || null)
  }, [participants])

  useEffect(() => {
    loadPick(selectedPid, selectedGw)
  }, [selectedPid, selectedGw, loadPick])

  // ── Derived state ─────────────────────────────────────────────────────────
  const pickIsLocked =
    phase === 'group' ||
    (phase === 'knockout' && knockoutSwapUsed)

  function getMultiplier(playerId) {
    if (!settings || !playerId || !selectedPid) return 1
    const player = players.find(p => p.id === playerId)
    if (!player) return 1
    const myTeams = ptRows.filter(r => r.participant_id === selectedPid)
    const match = myTeams.find(r => r.team_id === player.team_id)
    if (!match) return 1
    const pool = match.pool
    if (pool === 'A') return parseFloat(settings.team_a_multiplier) || 1.5
    if (pool === 'B') return parseFloat(settings.pool_b_team_mult)  || 1.5
    if (pool === 'C') return parseFloat(settings.pool_c_team_mult)  || 2
    return 1
  }

  const myTeams = ptRows.filter(r => r.participant_id === selectedPid)

  const filteredPlayers = search.length >= 2
    ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : []

  // ── Save pick ─────────────────────────────────────────────────────────────
  async function savePick(playerId) {
    if (!selectedPid || !selectedGw || !playerId || pickIsLocked) return
    setSaving(true); setSaveStatus('')

    const { error } = await supabase
      .from('player_picks')
      .upsert(
        { participant_id: selectedPid, gameweek_id: selectedGw, player_id: playerId },
        { onConflict: 'participant_id,gameweek_id' }
      )
    if (error) { setSaveStatus(`✗ ${error.message}`); setSaving(false); return }

    // In knockout phase, mark swap as used
    if (phase === 'knockout') {
      const { error: swapErr } = await supabase
        .from('participants')
        .update({ knockout_swap_used: true })
        .eq('id', selectedPid)
      if (swapErr) { setSaveStatus(`✗ ${swapErr.message}`); setSaving(false); return }
      setKnockoutSwapUsed(true)
      // Update local participants list too
      setParticipants(prev => prev.map(p =>
        p.id === selectedPid ? { ...p, knockout_swap_used: true } : p
      ))
    }

    setSaveStatus('✓ Pick saved!')
    setSearch('')
    await loadPick(selectedPid, selectedGw)
    setSaving(false)
  }

  // ── Pool badge colour ──────────────────────────────────────────────────────
  function poolStyle(pool) {
    if (pool === 'A') return { background:'#fef3c7', color:'#92400e' }
    if (pool === 'B') return { background:'#dbeafe', color:'#1e40af' }
    if (pool === 'C') return { background:'#dcfce7', color:'#166534' }
    return {}
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', color:C.muted }}>
      Loading…
    </div>
  )

  const currentGw = gameweeks.find(g => g.id === selectedGw)
  const currentPickPlayer = currentPick ? players.find(p => p.id === currentPick.player_id) : null
  const currentMult = currentPickPlayer ? getMultiplier(currentPickPlayer.id) : null

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Outfit', sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{ background:C.dark, padding:'0 20px', boxShadow:'0 2px 12px rgba(0,0,0,0.4)' }}>
        <div style={{ maxWidth:640, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>⚽</span>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:20, color:C.gold, letterSpacing:'0.04em' }}>
              THE RIFT · MY PICK
            </span>
          </div>
          <Link to="/" style={{ fontSize:13, color:'rgba(255,255,255,0.55)', textDecoration:'none' }}>← Leaderboard</Link>
        </div>
      </header>

      <main style={{ maxWidth:640, margin:'0 auto', padding:'24px 20px 60px' }}>

        {/* ── Participant selector ─────────────────────────────────────── */}
        <div style={{ marginBottom:20 }}>
          <label style={slabel}>Who are you?</label>
          <select value={selectedPid} onChange={e => { setSelectedPid(e.target.value); setSaveStatus('') }}
            style={{ ...sselect, width:'100%' }}>
            <option value="">— Select your name —</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* ── Gameweek selector ───────────────────────────────────────── */}
        {selectedPid && (
          <div style={{ marginBottom:24 }}>
            <label style={slabel}>Gameweek</label>
            <select value={selectedGw||''} onChange={e => setSelectedGw(e.target.value)}
              style={{ ...sselect, width:'100%' }}>
              {gameweeks.map(g => (
                <option key={g.id} value={g.id}>{g.label || `Week ${g.week_number}`}</option>
              ))}
            </select>
          </div>
        )}

        {selectedPid && (
          <>
            {/* ── My Teams ──────────────────────────────────────────── */}
            {myTeams.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <p style={slabel}>My Teams</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {myTeams.map(pt => {
                    const team = players.find(p => p.team_id === pt.team_id)
                    const teamName = (players.find(p => p.team_id === pt.team_id)?.teams?.name) ||
                      ptRows.filter(r => r.team_id === pt.team_id)[0]?.team_id || pt.team_id
                    // Get team name from a separate lookup
                    return null // replaced below
                  })}
                </div>
                <MyTeamsBadges ptRows={myTeams} poolStyle={poolStyle} />
              </div>
            )}

            {/* ── Phase status banner ───────────────────────────────── */}
            {phase === 'group' && (
              <div style={bannerStyle('#eff6ff','#bfdbfe')}>
                <span style={{ fontSize:22 }}>🔒</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#1e40af' }}>Picks locked — Group Stage</div>
                  <div style={{ fontSize:13, color:'#3b82f6', marginTop:3 }}>
                    Your pick is locked in until the admin advances to the Knockout phase.
                  </div>
                </div>
              </div>
            )}

            {phase === 'knockout' && !knockoutSwapUsed && (
              <div style={bannerStyle('#fefce8','#fde047')}>
                <span style={{ fontSize:22 }}>⚡</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#854d0e' }}>1 swap available — Knockout Phase</div>
                  <div style={{ fontSize:13, color:'#a16207', marginTop:3 }}>
                    You can change your pick once. After saving, your pick is locked for the rest of the tournament.
                  </div>
                </div>
              </div>
            )}

            {phase === 'knockout' && knockoutSwapUsed && (
              <div style={bannerStyle('#f0fdf4','#86efac')}>
                <span style={{ fontSize:22 }}>✅</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#15803d' }}>Knockout swap used</div>
                  <div style={{ fontSize:13, color:'#16a34a', marginTop:3 }}>
                    Your pick is locked for the remainder of the tournament.
                  </div>
                </div>
              </div>
            )}

            {/* ── Current pick card ─────────────────────────────────── */}
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'18px 20px', marginBottom:24 }}>
              <p style={{ ...slabel, marginBottom:10 }}>
                Current pick — {currentGw?.label || `Week ${currentGw?.week_number}`}
              </p>
              {currentPickPlayer ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:18, color:C.dark }}>{currentPickPlayer.name}</div>
                    <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>{currentPickPlayer.teams?.name}</div>
                  </div>
                  {currentMult && currentMult > 1 && (
                    <div style={{ background:'#d1fae5', color:'#065f46', borderRadius:8, padding:'6px 14px', fontWeight:700, fontSize:15 }}>
                      ★ {currentMult}× boost
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color:'#dc2626', fontSize:14, margin:0 }}>No pick yet this gameweek</p>
              )}
            </div>

            {/* ── Player search (only when unlocked) ────────────────── */}
            {!pickIsLocked && (
              <div>
                <label style={slabel}>
                  {currentPickPlayer ? 'Change your pick' : 'Choose your player'}
                </label>
                <input
                  type="text"
                  placeholder="Type 2+ letters to search…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSaveStatus('') }}
                  style={{ ...sinput, width:'100%', boxSizing:'border-box', marginBottom:8 }}
                />

                {search.length >= 2 && (
                  <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
                    {filteredPlayers.length === 0 ? (
                      <div style={{ padding:'14px 16px', color:C.muted, fontSize:14 }}>No players found</div>
                    ) : (
                      filteredPlayers.slice(0, 30).map((pl, i) => {
                        const mult = getMultiplier(pl.id)
                        const isBoost = mult > 1
                        return (
                          <button key={pl.id} onClick={() => savePick(pl.id)} disabled={saving}
                            style={{
                              display:'flex', alignItems:'center', justifyContent:'space-between',
                              width:'100%', padding:'12px 16px', border:'none', borderBottom: i < filteredPlayers.length-1 ? '1px solid #f1f5f9' : 'none',
                              background: isBoost ? '#f0fdf4' : '#fff',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              textAlign:'left', gap:12,
                            }}>
                            <div>
                              <div style={{ fontWeight: isBoost ? 700 : 500, fontSize:14, color:C.dark }}>{pl.name}</div>
                              <div style={{ fontSize:12, color:C.muted, marginTop:1 }}>{pl.teams?.name} · {pl.position}</div>
                            </div>
                            {isBoost && (
                              <span style={{ background:'#16a34a', color:'#fff', borderRadius:6, padding:'3px 10px', fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>
                                ★ {mult}×
                              </span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}

                {saveStatus && (
                  <div style={{ padding:'10px 14px', borderRadius:8, fontSize:14, textAlign:'center',
                    background: saveStatus.startsWith('✓') ? '#d1fae5' : '#fee2e2',
                    color: saveStatus.startsWith('✓') ? '#065f46' : '#991b1b' }}>
                    {saveStatus}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!selectedPid && (
          <div style={{ textAlign:'center', padding:'48px 0', color:C.muted }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚽</div>
            <div style={{ fontSize:15 }}>Select your name above to view and manage your pick</div>
          </div>
        )}

      </main>
    </div>
  )
}

// ── Sub-component: renders team badges with pool colours ───────────────────
function MyTeamsBadges({ ptRows, poolStyle }) {
  const [teamNames, setTeamNames] = useState({})

  useEffect(() => {
    if (!ptRows.length) return
    const ids = ptRows.map(r => r.team_id)
    supabase.from('teams').select('id, name').in('id', ids).then(({ data }) => {
      if (!data) return
      const map = {}
      data.forEach(t => { map[t.id] = t.name })
      setTeamNames(map)
    })
  }, [ptRows])

  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {ptRows.map(pt => (
        <span key={pt.team_id} style={{
          ...poolStyle(pt.pool),
          borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:600,
        }}>
          {teamNames[pt.team_id] || '…'} <span style={{ opacity:0.6, fontSize:11 }}>Pool {pt.pool}</span>
        </span>
      ))}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function bannerStyle(bg, borderColor) {
  return {
    background: bg,
    border: `1.5px solid ${borderColor}`,
    borderRadius: 10,
    padding: '14px 18px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  }
}

const slabel = { display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }
const sinput  = { padding:'10px 14px', border:'1px solid #d1d5db', borderRadius:8, fontSize:15, fontFamily:'inherit', outline:'none' }
const sselect = { padding:'10px 14px', border:'1px solid #d1d5db', borderRadius:8, fontSize:15, fontFamily:'inherit', background:'#fff' }
