//Form to remove a redirect
import { Card, Typography, TextField } from '@mui/material'

import { store } from "./store.js"
import { useSnapshot } from "valtio";

export default function Rem() {
    const snap = useSnapshot(store)
    return <Card sx={{ p: 2 }}>
        <Typography variant="h5">Remove a redirect</Typography>
        <TextField variant='filled' label="Forward Code" id="remCode" sx={{ width: '100%' }} value={snap.remCode} onChange={(e) => store.remCode = e.target.value} />
    </Card>
}