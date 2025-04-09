import React, { useState, useEffect } from 'react';
import { BeatLoader } from 'react-spinners';
import { Stepper, Step, StepLabel, Button, Typography, Box, Paper, FormControlLabel, Checkbox, Grid } from '@mui/material';
import PricingCard from './PricingCard.tsx';
import AddressForm from './AddressForm.tsx';
import PaymentFormComponent from './PaymentFormComponent.tsx';
import { MONTHLY_PRICE_STRING, DEBUG_MODE, printLog } from '../constants/constants.ts';

const steps = ['Sign In', 'Billing', 'Card'];
const paymentServerUrl = DEBUG_MODE === false ? "https://cascdr-auth-backend-cw4nk.ondigitalocean.app" : "http://localhost:4020";

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
            printLog(`customer email: ${userEmail}`)
            printLog(`card result: ${result}`)
            printLog(`Payment token is ${result.token}`);
            const paymentToken = result.token;
            printLog(`payment token: ${paymentToken}`);
            printLog(`formData:${formData}`);
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
            <Typography
              variant="caption"
              sx={{ color: 'grey', marginTop: '1rem', display: 'block', textAlign: 'center' }}
            >
              *We are required to send this information to Square to store your card on file & guarantee
              uninterrupted access to Jamie. We do not otherwise store this information.
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
      <div className="bg-black w-[95%] sm:w-[90%] max-h-[90vh] overflow-auto shadow-[0_0_15px_rgba(255,255,255,0.4)] rounded-lg">
        <div className="flex flex-col lg:flex-row h-full">
          <div className="w-full lg:w-1/3 p-4 hidden lg:flex items-center justify-center">
          <PricingCard 
              plan="Jamie Plan Selected"
              price={MONTHLY_PRICE_STRING.replace('$', '')}
              description="Productivity and Privacy at your fingertips with Jamie & other CASCDR apps."
              features={[
                "Unlimited usage",
                "Access 20+ CASCDR Apps",
                "Early previews of new features"
              ]}
            />
          </div>

          <div className="w-full lg:w-2/3">
            <Paper
              sx={{
                padding: { xs: '0.75rem', sm: '1rem' },
                width: '95%',
                maxWidth: '600px',
                borderRadius: '12px',
                backgroundColor: 'black',
                color: 'white',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
                margin: '0 auto',
                position: 'relative',
              }}
            >
              <div className="flex justify-end">
                <button className="text-white text-xl px-3 py-1 absolute top-1 right-1" onClick={onClose}>
                  X
                </button>
              </div>
              
              <Typography variant="h5" align="center" sx={{ 
                marginTop: { xs: 2, sm: 3 },
                marginBottom: { xs: 0, sm: 0.5 }, 
                color: 'white', 
                fontSize: { xs: '1.2rem', sm: '1.5rem' }
              }}>
                {activeStep === 0 ? 'Subscribe' : 'Checkout'}
              </Typography>

              <div className="lg:hidden">
                <Typography 
                  variant="subtitle2" 
                  align="center" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.8)', 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    mb: 1,
                    fontWeight: 'normal'
                  }}
                >
                  Jamie Plan: {MONTHLY_PRICE_STRING}/mo
                </Typography>
              </div>

              <Stepper
                activeStep={activeStep}
                sx={{
                  marginBottom: { xs: '0.5rem', sm: '1rem' },
                  '& .MuiStepLabel-root .Mui-completed': { color: 'white' },
                  '& .MuiStepLabel-root .Mui-active': { color: 'white' },
                  '& .MuiStepLabel-root .MuiStepIcon-root': {
                    color: 'white',
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                    '& .MuiStepIcon-text': { fill: 'black' },
                  },
                  '& .MuiStepLabel-label': { 
                    color: 'white',
                    fontSize: { xs: '0.7rem', sm: '0.8rem' }
                  },
                  '& .MuiStepLabel-label.Mui-active': { color: 'white !important' },
                  '& .MuiStepConnector-line': { borderColor: 'white', borderTopWidth: '3px' },
                  '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
                    borderColor: 'white',
                  },
                }}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              <div className={activeStep === 2 ? 'max-h-[200px] overflow-visible' : ''}>{getStepContent(activeStep)}</div>

              {activeStep === 2 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      sx={{ 
                        color: 'white',
                        '&.Mui-checked': { color: 'white' },
                        padding: '2px',
                        '& .MuiSvgIcon-root': { fontSize: 18 }
                      }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ color: 'white' }}>
                      I consent to saving my payment information for a monthly subscription at {MONTHLY_PRICE_STRING}
                    </Typography>
                  }
                  sx={{ marginTop: '0.5rem', color: 'white' }}
                />
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: { xs: '0.5rem', sm: '1rem' } }}>
                {activeStep > 0 && (
                  <Button
                    variant="contained"
                    onClick={handleBack}
                    disabled={activeStep < 2}
                    size="small"
                    sx={{
                      backgroundColor: 'white',
                      color: 'black',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      padding: { xs: '4px 8px', sm: '6px 12px' },
                      '&:hover': { backgroundColor: '#e0e0e0' },
                      '&:disabled': { backgroundColor: '#404040', color: '#808080' },
                    }}
                  >
                    Back
                  </Button>
                )}
                {activeStep < steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={!formData.firstName}
                    size="small"
                    sx={{
                      backgroundColor: 'white',
                      color: 'black',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      padding: { xs: '4px 8px', sm: '6px 12px' },
                      '&:hover': { backgroundColor: '#e0e0e0' },
                      '&:disabled': { backgroundColor: '#404040', color: '#808080' },
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handlePayment}
                    disabled={!consent || isPaymentProcessing}
                    size="small"
                    sx={{
                      backgroundColor: 'white',
                      color: 'black',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      padding: { xs: '4px 8px', sm: '6px 12px' },
                      '&:hover': { backgroundColor: '#e0e0e0' },
                      '&:disabled': { backgroundColor: '#404040', color: '#808080' },
                    }}
                  >
                    {isPaymentProcessing ? <BeatLoader color="#000" size={5} /> : 'Subscribe'}
                  </Button>
                )}
              </Box>
            </Paper>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;