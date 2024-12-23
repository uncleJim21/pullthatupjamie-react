import React from 'react';
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

export default PricingCard;