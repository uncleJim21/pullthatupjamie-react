import React from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import './PricingCard.css'; // You'll need to create this CSS file

const PricingCard = ({ plan, price, description, features, buttonText, isHighlighted }) => {
  return (
    <div className={`pricing-card ${isHighlighted ? 'highlighted' : ''}`}>
      <h2 className="plan-name">{plan}</h2>
      <p className="plan-description">{description}</p>
      <div className="price">
        <span className="currency">$</span>
        <span className="amount">{price}</span>
        <span className="period">/mo</span>
      </div>
      {/* Uncomment the button if needed */}
      {/* <button className="cta-button">{buttonText}</button> */}
      <ul className="feature-list">
        {features.map((feature, index) => (
          <li key={index} className="feature-item">
            <span className="checkmark">✓</span> {feature}
          </li>
        ))}
      </ul>
    </div>
  );
};

// Define PropTypes to specify expected props and types
PricingCard.propTypes = {
  plan: PropTypes.string.isRequired,         // The name of the plan
  price: PropTypes.oneOfType([               // The price (number or string)
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  description: PropTypes.string.isRequired,  // A description of the plan
  features: PropTypes.arrayOf(               // An array of features (strings)
    PropTypes.string
  ).isRequired,
  buttonText: PropTypes.string,              // Optional button text
  isHighlighted: PropTypes.bool,             // Highlight the card (optional)
};

// Define default props for optional fields
PricingCard.defaultProps = {
  buttonText: 'Subscribe', // Default button text
  isHighlighted: false,    // Default to not highlighted
};

export default PricingCard;
