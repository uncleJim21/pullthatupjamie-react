import React, { useState, useEffect, Fragment } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';

export default function AddressForm({ setParentFormData, parentFormData }) {
  const [formData, setFormData] = useState(parentFormData);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleStateFieldChange = (event) => {
    let value = event.target.value;
    // Limit the input to 2 characters and convert to uppercase
    value = value.slice(0, 2).toUpperCase();

    setFormData({
      ...formData,
      [event.target.name]: value,
    });
  };

  useEffect(() => {
    setParentFormData(formData);
  }, [formData, setParentFormData]);

  return (
    <Fragment>
      <Box
        sx={{
          backgroundColor: 'black',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ color: 'white', mb: 2 }}>
          Billing Address
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="firstName"
              name="firstName"
              label="First Name"
              fullWidth
              autoComplete="given-name"
              variant="standard"
              value={formData.firstName}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="lastName"
              name="lastName"
              label="Last Name"
              fullWidth
              autoComplete="family-name"
              variant="standard"
              value={formData.lastName}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              required
              id="address1"
              name="address1"
              label="Address Line 1"
              fullWidth
              autoComplete="shipping address-line1"
              variant="standard"
              value={formData.address1}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              id="address2"
              name="address2"
              label="Address Line 2"
              fullWidth
              autoComplete="shipping address-line2"
              variant="standard"
              value={formData.address2}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="city"
              name="city"
              label="City"
              fullWidth
              autoComplete="shipping address-level2"
              variant="standard"
              value={formData.city}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="state"
              name="state"
              label="2 Letter State Code"
              fullWidth
              variant="standard"
              value={formData.state}
              onChange={handleStateFieldChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="zip"
              name="zip"
              label="Zip / Postal Code"
              fullWidth
              autoComplete="shipping postal-code"
              variant="standard"
              value={formData.zip}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="country"
              name="country"
              label="Country"
              fullWidth
              autoComplete="shipping country"
              variant="standard"
              value={formData.country}
              onChange={handleChange}
              sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
            />
          </Grid>
        </Grid>
      </Box>
    </Fragment>
  );
}
