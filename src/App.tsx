import gitLogo from './github-mark-white.svg'
import './App.css'

import { AppBar, Toolbar, Box, IconButton, Typography, TextField, InputAdornment } from '@mui/material'

import SearchIcon from '@mui/icons-material/Search';
import Add from './Add';
import Rem from './Rem';
import List from './List';

function App() {
  return (<>
    <AppBar>
      <Toolbar>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <Typography variant="h4">Manage shortURLs</Typography>
          <TextField
            variant="filled"
            label="Search codes and destinations"
            id="input-with-icon-textfield"
            sx={{ flexGrow: 1, mx: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <IconButton edge="start" color="inherit" aria-label="open drawer">
            <a href="https://github.com/master-harvey/shortURLs" target="_blank">
              <img src={gitLogo} className="Github logo" alt="Github logo" id="logo" />
            </a>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar >

    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ m: 2 }}><Add /></Box>
        <Box sx={{ m: 2 }}><Rem /></Box>
      </Box>
      <List />
    </Box>
  </>)
}

export default App