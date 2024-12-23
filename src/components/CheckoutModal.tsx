import React, { useState, useEffect } from 'react';
import { BeatLoader } from 'react-spinners';
import { Stepper, Step, StepLabel, Button, Typography, Box, Paper, FormControlLabel, Checkbox } from '@mui/material';
import PricingCard from './PricingCard.tsx';
import AddressForm from './AddressForm.tsx';
import PaymentFormComponent from './PaymentFormComponent.tsx';
import cascdrAmber from '../../../media/images/cascdrAmberLogo.png';
import squareLogo from '../../../media/images/misc/squareLogo.png';

const steps = ['Sign In', 'Billing Address', 'Payment Details'];
const debug = false
const paymentServerUrl = (debug === false) ? "https://cascdr-auth-backend-cw4nk.ondigitalocean.app" : "http://localhost:4000";


export const CheckoutModal = ({ isOpen, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [card, setCard] = useState(null);

  const handleNext = () => setActiveStep(activeStep + 1);
  const handleBack = () => setActiveStep(activeStep - 1);

  const handlePayment = async () => {
    setIsPaymentProcessing(true);
    setPaymentFailed(false);
    try {
        if(!card){throw new Error('Square API error');}
        const result = await card.tokenize();
        const userEmail = localStorage.getItem('squareId');
        const statusContainer = document.getElementById('payment-status-container');
        setIsPaymentProcessing(true);
        setPaymentFailed(false);
        if(statusContainer){statusContainer.innerHTML = "Processing..."}
        if (result.status === 'OK' && result.token && userEmail) {
            console.log("customer email:", userEmail)
            console.log("card result:",result)
            console.log(`Payment token is ${result.token}`);
            const paymentToken = result.token;
            console.log("payment token:", paymentToken);
            console.log("formData:", formData);
            const card = {
            "billing_address":{
                "address_line_1":formData.address1,
                "address_line_2":formData.address2,
                "locality":formData.city,
                "administrative_district_level_1":formData.state,
                "postal_code":formData.zip,
                "country":formData.country
            }
            }
            const cardholderName = `${formData.firstName} ${formData.lastName}`
            const response = await fetch(`${paymentServerUrl}/purchase-subscription`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  email: userEmail,
                  paymentToken,
                  productName: "amber",
                  cardholderName,
                  card
                })
              });

            if (!response.ok) {
            throw new Error('Payment request failed');
            }

            await response.json();
            
            localStorage.setItem("isSubscribed", "true")
            if(statusContainer) {
            statusContainer.innerHTML = "Payment Successful";
            }
            setIsPaymentProcessing(false);
            onSuccess();
        } else {
            setPaymentFailed(true);
            throw new Error('Payment failed');
        }
    } catch (error) {
      setPaymentFailed(true);
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 1:
        return (
          <>
          <Typography variant="caption" sx={{ color: 'white', marginTop: '1rem', display: 'block', textAlign: 'center' }}>
              *We are required to send this information to Square to store your card on file & guarantee uninterrupted access to Jamie. We do not otherwise store this information.
            </Typography>
            <AddressForm setParentFormData={setFormData} parentFormData={formData} />
          </>
        );
      case 2:
        return (
          <PaymentFormComponent
            setCard={setCard}
            setPaymentProcessing={setIsPaymentProcessing}
            paymentProcessing={isPaymentProcessing}
            paymentFailed={paymentFailed}
          />
        );
      default:
        return <Typography sx={{ color: 'white' }}>Sign in to proceed.</Typography>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <Paper
        sx={{
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          borderRadius: '12px',
          backgroundColor: 'black',
          color: 'white',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex justify-end">
          <button className="text-white" onClick={onClose}>X</button>
        </div>
        <Typography variant="h5" align="center" sx={{ marginBottom: '1rem', color: 'white' }}>
          {activeStep === 0 ? 'Subscribe' : 'Checkout'}
        </Typography>
        <Stepper 
            activeStep={activeStep} 
            sx={{
                marginBottom: '1.5rem',
                '& .MuiStepLabel-root .Mui-completed': {
                color: 'white'
                },
                '& .MuiStepLabel-root .MuiStepIcon-root': {
                color: 'white',
                '& .MuiStepIcon-text': {
                    fill: 'black'
                }
                },
                '& .MuiStepLabel-label': {
                color: 'white'
                },
                '& .MuiStepLabel-label.Mui-active': {
                color: 'white !important'
                },
                '& .MuiStepConnector-line': {
                borderColor: 'white'
                }
            }}
            >
            {steps.map((label) => (
                <Step key={label}>
                <StepLabel>{label}</StepLabel>
                </Step>
            ))}
        </Stepper>

        {getStepContent(activeStep)}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          {activeStep > 0 && (
            <Button variant="outlined" onClick={handleBack} disabled={activeStep < 2} sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white' } }}>Back</Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={handleNext} disabled={!formData.firstName} sx={{ backgroundColor: 'white', color: 'black', '&:hover': { backgroundColor: 'white' } }}>Next</Button>
          ) : (
            <Button
              variant="contained"
              onClick={handlePayment}
              disabled={!consent || isPaymentProcessing}
              sx={{ backgroundColor: 'white', color: 'black', '&:hover': { backgroundColor: 'white' } }}
            >
              {isPaymentProcessing ? <BeatLoader color="#000" /> : 'Subscribe'}
            </Button>
          )}
        </Box>
        {activeStep === 2 && (
          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} sx={{ color: 'white' }} />}
            label="I consent to saving my payment information."
            sx={{ marginTop: '1rem', color: 'white' }}
          />
        )}
      </Paper>
    </div>
  );
};

export default CheckoutModal;