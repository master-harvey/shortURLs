import gitLogo from './github-mark-white.svg'
import './App.css'

import { AppBar, Toolbar, Box, IconButton, Typography, TextField, InputAdornment, Card, Button } from '@mui/material'

import SearchIcon from '@mui/icons-material/Search';
import Add from './Add';
import Rem from './Rem';
import List from './List';

import { store } from "./store.js"
import { useSnapshot } from "valtio";

import { functionURL } from "./functionURL.txt"

function App() {
  const snap = useSnapshot(store)

  return (<>
    <AppBar sx={{ backgroundColor: '#fe3232' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <IconButton edge="start" color="inherit" aria-label="open drawer" sx={{ p: 0, my: 1, mx: 2 }}>
              <a href="https://github.com/master-harvey/shortURLs" target="_blank">
                <img src={gitLogo} className="Github logo" alt="Github logo" id="logo" />
              </a>
            </IconButton>
            <Typography sx={{ mr: 2 }} variant="h4">Manage shortURLs</Typography>
          </Box>
          <TextField variant="filled" label="Search codes and destinations" id="input-with-icon-textfield" sx={{ flexGrow: 1 }}
            value={snap.searchBar}
            onChange={(e) => store.searchBar = e.target.value}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Toolbar>
    </AppBar >

    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Card sx={{ p: 2, m: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-around' }}>
          <TextField type="password" variant='filled' label="PassKey" value={snap.passKey} onChange={(e) => store.passKey = e.target.value} id="input-with-icon-textfield" sx={{ width: '60%', mx: 2 }} />
          <Button variant="outlined" sx={{ my: 1 }} onClick={() => console.log(store)}>Submit</Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ m: 1, flexGrow: 1 }}><Add /></Box>
          <Box sx={{ m: 1, flexGrow: 1 }}><Rem /></Box>
        </Box>
      </Card>
      <List />
    </Box>
  </>)
}

export default App