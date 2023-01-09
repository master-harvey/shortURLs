//Form to add a redirect
import { Card, Typography, Box } from '@mui/material'

export default function Add() {
    return <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h5">Add a redirect</Typography>
        </Box>
    </Card>
}