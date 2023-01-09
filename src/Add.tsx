//Form to add a redirect
import { Card, Typography, Box, TextField } from '@mui/material'

import { store } from "./store.js"
import { useSnapshot } from "valtio";

export default function Add() {
    const snap = useSnapshot(store)
    return <Card sx={{ p: 2 }}>
        <Typography variant="h5">Add a redirect</Typography>
        <TextField variant='filled' label="Forward URL" id="addURL" sx={{ width: '100%' }} value={snap.addURL} onChange={(e) => store.addURL = e.target.value} />
    </Card>
}