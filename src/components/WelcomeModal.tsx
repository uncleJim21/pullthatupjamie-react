"use client"

import React from "react"
import { useState, useEffect } from "react"

interface WelcomeModalProps {
  isOpen: boolean
  onQuickTour: () => void
  onGetStarted: () => void
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onQuickTour, onGetStarted }) => {
  const [displayText, setDisplayText] = useState("")
  const [showSecondLine, setShowSecondLine] = useState(false)
  const [showButtons, setShowButtons] = useState(false)

  const firstLine = "The Fastest Pod Assistant in the West 🤠."
  const secondLine = "Search, Share, and Clip with Speed & Precision."

  useEffect(() => {
    if (!isOpen) {
      setDisplayText("")
      setShowSecondLine(false)
      setShowButtons(false)
      return
    }

    // Start typing immediately - much faster
    const startDelay = setTimeout(() => {
      let i = 0
      const typeFirstLine = () => {
        if (i < firstLine.length) {
          setDisplayText(firstLine.slice(0, i + 1))
          i++
          setTimeout(typeFirstLine, 25) // Much faster typing
        } else {
          // Show second line quickly
          setTimeout(() => {
            setShowSecondLine(true)
            setTimeout(() => setShowButtons(true), 150) // Faster button reveal
          }, 200)
        }
      }
      typeFirstLine()
    }, 300) // Start sooner

    return () => clearTimeout(startDelay)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
      <div className="relative flex flex-col items-center justify-between w-full max-w-sm sm:max-w-md h-auto max-h-[90vh] rounded-2xl bg-[#111] border border-gray-800 shadow-2xl px-6 sm:px-8 py-8 sm:py-12 overflow-hidden">
        {/* Star Trek Warp Speed Background INSIDE Modal */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {/* Warp speed streaking lines */}
          <div className="absolute inset-0">
            {[...Array(30)].map((_, i) => {
              const delay = Math.random() * 3
              const duration = 0.8 + Math.random() * 0.4
              const startY = Math.random() * 100
              const angle = 45 + Math.random() * 15 // Steeper angle for backward travel effect (45-60 degrees)
              const opacity = 0.5 // Consistent 50% opacity
              const thickness = 1 + Math.random() * 2

              return (
                <div
                  key={`warp-${i}`}
                  className="absolute bg-gradient-to-r from-transparent via-white to-transparent"
                  style={{
                    width: "200%",
                    height: `${thickness}px`,
                    top: `${startY}%`,
                    left: "-100%",
                    opacity: 0,
                    transform: `rotate(${angle}deg)`,
                    animation: `warpSpeed ${duration}s linear ${delay}s infinite`,
                    boxShadow: `0 0 ${thickness * 2}px rgba(255, 255, 255, ${opacity})`,
                  }}
                />
              )
            })}
          </div>

          {/* Additional faster streaks for more intensity */}
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => {
              const delay = Math.random() * 2
              const duration = 0.4 + Math.random() * 0.3
              const startY = Math.random() * 100
              const angle = 50 + Math.random() * 10 // Steeper angle for backward travel (50-60 degrees)
              const thickness = 0.5 + Math.random() * 1

              return (
                <div
                  key={`fast-warp-${i}`}
                  className="absolute bg-gradient-to-r from-transparent via-blue-200 to-transparent"
                  style={{
                    width: "250%",
                    height: `${thickness}px`,
                    top: `${startY}%`,
                    left: "-125%",
                    opacity: 0,
                    transform: `rotate(${angle}deg)`,
                    animation: `warpSpeedFast ${duration}s linear ${delay}s infinite`,
                    boxShadow: `0 0 ${thickness * 3}px rgba(147, 197, 253, 0.5)`, // 50% opacity
                  }}
                />
              )
            })}
          </div>

          {/* Occasional bright flashes */}
          <div className="absolute inset-0">
            {[...Array(8)].map((_, i) => {
              const delay = Math.random() * 4 + 1
              const duration = 0.3 + Math.random() * 0.2
              const startY = Math.random() * 100
              const angle = 55 + Math.random() * 5 // Steeper, more consistent angle (55-60 degrees)

              return (
                <div
                  key={`flash-${i}`}
                  className="absolute bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
                  style={{
                    width: "300%",
                    height: "3px",
                    top: `${startY}%`,
                    left: "-150%",
                    opacity: 0,
                    transform: `rotate(${angle}deg)`,
                    animation: `warpFlash ${duration}s linear ${delay}s infinite`,
                    boxShadow: "0 0 10px rgba(103, 232, 249, 0.5)", // 50% opacity
                  }}
                />
              )
            })}
          </div>

          {/* Subtle background glow */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `
                radial-gradient(ellipse at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%),
                linear-gradient(45deg, rgba(6, 182, 212, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)
              `,
            }}
          />
        </div>

        {/* Content - with higher z-index */}
        <div className="relative z-10 flex flex-col items-center justify-between w-full h-full">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <div className="relative" style={{ animation: "logoEntrance 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)" }}>
              <img
                src="/jamie-logo.png"
                alt="Jamie Logo"
                className="w-32 h-20 sm:w-48 sm:h-32 object-contain relative z-10"
                style={{
                  filter: "drop-shadow(0 0 30px rgba(139, 92, 246, 0.3))",
                  animation: "logoGlow 3s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-6 sm:mb-8 flex-1 flex flex-col justify-center">
            <h1
              className="text-2xl sm:text-3xl font-bold text-white mb-4"
              style={{
                fontFamily: "'Inter', 'Poppins', system-ui, sans-serif",
                fontWeight: "700",
                letterSpacing: "-0.02em",
                animation: "titleSlide 0.3s ease-out 0.1s both",
              }}
            >
              Welcome to PullThatJamie.ai
            </h1>

            <div className="min-h-[4rem] flex flex-col justify-center space-y-1">
              <p
                className="text-gray-300 text-base sm:text-lg px-2"
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: "400",
                  lineHeight: "1.5",
                }}
              >
                {displayText}
                {displayText && displayText.length < firstLine.length && (
                  <span
                    className="inline-block w-0.5 h-5 bg-gradient-to-b from-purple-400 to-cyan-400 ml-1"
                    style={{ animation: "cursorBlink 0.8s infinite" }}
                  />
                )}
              </p>

              {showSecondLine && (
                <p
                  className="text-gray-300 text-base sm:text-lg px-2"
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: "400",
                    lineHeight: "1.5",
                    animation: "slideUp 0.3s ease-out",
                  }}
                >
                  {secondLine}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {showButtons && (
            <div className="flex flex-col gap-3 w-full" style={{ animation: "buttonsSlide 0.3s ease-out" }}>
              <button
                onClick={onQuickTour}
                className="w-full bg-gradient-to-r from-white to-gray-100 text-black px-6 py-3 rounded-lg font-semibold text-base sm:text-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  boxShadow: "0 4px 20px rgba(255, 255, 255, 0.1)",
                }}
              >
                Quick Tour
              </button>
              <button
                onClick={onGetStarted}
                className="w-full bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] hover:from-[#252525] hover:to-[#353535] text-white px-6 py-3 rounded-lg border border-gray-600 font-semibold text-base sm:text-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  boxShadow: "0 4px 20px rgba(139, 92, 246, 0.1)",
                }}
              >
                Get Started
              </button>
            </div>
          )}
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@400;600;700&display=swap');
  
          @keyframes logoEntrance {
            from { opacity: 0; transform: translateY(-30px) scale(0.8); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes logoGlow {
            0%, 100% { filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.3)); }
            50% { filter: drop-shadow(0 0 40px rgba(6, 182, 212, 0.4)); }
          }

          @keyframes titleSlide {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes buttonsSlide {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes cursorBlink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }

          /* Star Trek Warp Speed Animations */
          @keyframes warpSpeed {
            0% { opacity: 0; transform: translateX(-100%) rotate(var(--angle, 0deg)); }
            5% { opacity: 0.5; }
            95% { opacity: 0.5; }
            100% { opacity: 0; transform: translateX(100%) rotate(var(--angle, 0deg)); }
          }

          @keyframes warpSpeedFast {
            0% { opacity: 0; transform: translateX(-125%) rotate(var(--angle, 0deg)); }
            10% { opacity: 0.5; }
            90% { opacity: 0.5; }
            100% { opacity: 0; transform: translateX(125%) rotate(var(--angle, 0deg)); }
          }

          @keyframes warpFlash {
            0% { opacity: 0; transform: translateX(-150%) rotate(var(--angle, 0deg)); }
            20% { opacity: 0.5; }
            80% { opacity: 0.5; }
            100% { opacity: 0; transform: translateX(150%) rotate(var(--angle, 0deg)); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default WelcomeModal
