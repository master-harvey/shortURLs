import { useState, useEffect } from 'react'

import gitLogo from './github-mark-white.svg'
import './App.css'

import { AppBar, Toolbar, Box, IconButton, Typography, TextField, Card, Button, CircularProgress } from '@mui/material'

import SearchIcon from '@mui/icons-material/Search';

import { store } from "./store.js"
import { useSnapshot } from "valtio";

function App() {
  const snap = useSnapshot(store)

  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [results, setResults] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const [functionURL, setFunctionURL] = useState("")

  useEffect(() => { fetch('./functionURL.txt').then((r) => r.text()).then((u) => setFunctionURL(u)) }, [])

  function handleSubmit() {
    setError(false)
    setLoading(true)

    fetch(functionURL, {
      method: store.addURL ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "redirectTo": store.addURL, "redirectFrom": store.remCode, "key": store.passKey })
    })
      .then(r => r.json()).then((r) => { setSuccess(true); setError(false); setResults(r) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  function handleSearch() {
    setSearchError(false)
    setLoadingSearch(true)
    fetch(`https://${window.location.host.slice(window.location.host.indexOf('.') + 1)}/${store.searchBar}`)
      .then(() => { setSuccess(true); setSearchError(false); })
      .catch(() => setSearchError(true))
      .finally(() => setLoadingSearch(false))
  }

  return (<>
    <AppBar sx={{ backgroundColor: '#fe3232' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <IconButton edge="start" color="inherit" sx={{ p: 0, my: 1, mx: 2 }}>
              <a href="https://github.com/master-harvey/shortURLs" target="_blank">
                <img src={gitLogo} className="Github logo" alt="Github logo" id="logo" />
              </a>
            </IconButton>
            <Typography sx={{ mr: 2 }} variant="h4">Manage shortURLs</Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexGrow: 1 }}>
            <TextField variant="filled" label={searchError ? "An error occurred with this search" : "Search for a redirect code"} sx={{ flexGrow: 1 }}
              value={snap.searchBar}
              onChange={(e) => store.searchBar = e.target.value}
            />
            {loadingSearch ? <CircularProgress sx={{ mr: 1, ml: 2, color: '#111' }} /> : <IconButton sx={{ p: 1, mx: 1 }} onClick={handleSearch}><SearchIcon /></IconButton>}
          </Box>
        </Box>
      </Toolbar>
    </AppBar >

    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Card sx={{ p: 2, m: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-around', my: 1 }}>
          <TextField type="password" variant='filled' label="PassKey" value={snap.passKey} onChange={(e) => store.passKey = e.target.value.substring(0, 6)} id="input-with-icon-textfield" sx={{ width: '60%', mx: 2 }} />
          {loading ? <CircularProgress /> : <Button variant="outlined" sx={{ my: 1 }} disabled={(!snap.passKey || (!snap.addURL && !snap.remCode))} onClick={handleSubmit}>Submit</Button>}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ m: 1, flexGrow: 1 }}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h5">Add a redirect</Typography>
              <TextField variant='filled' label="Forward URL" id="addURL" sx={{ width: '100%' }} value={snap.addURL} onChange={(e) => { store.addURL = e.target.value; store.remCode = ""; }} />
            </Card>
          </Box>
          <Box sx={{ m: 1, flexGrow: 1 }}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h5">Remove a redirect</Typography>
              <TextField variant='filled' label="Forward Code" id="remCode" sx={{ width: '100%' }} value={snap.remCode} onChange={(e) => { store.remCode = e.target.value; store.addURL = ""; }} />
            </Card>
          </Box>
        </Box>
      </Card>
      {searchError && <Typography variant="body1">An error occurred while searching for that code</Typography>}
      {results && <Box sx={{ backgroundColor: '#fe3232', p: 2, mt: 2, width: '100%', borderRadius: '2em' }}>
        <Typography variant="h4">{ }</Typography>
      </Box>}
    </Box>
  </>)
}

export default App