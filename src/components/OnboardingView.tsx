import { useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../services/api';
import { Sparkles, ArrowRight } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: () => void;
}

const questions = [
  {
    id: 1,
    question: "How sweet do you like your life?",
    options: ["0% Sugar", "30% Sugar", "50% Sugar", "70% Sugar", "100% Sugar"]
  },
  {
    id: 2,
    question: "Pick your temperature",
    options: ["Icy Cold", "Room Temp", "Hot & Cozy"]
  },
  {
    id: 3,
    question: "Favorite Tea Base?",
    options: ["Black Tea", "Green Tea", "Oolong", "Fruit Tea", "No Tea"]
  },
  {
    id: 4,
    question: "Topping of choice?",
    options: ["Boba Pearls", "Coconut Jelly", "Pudding", "Cheese Foam", "None"]
  },
  {
    id: 5,
    question: "What's the vibe?",
    options: ["Working Hard", "Chilling", "Party Time", "Date Night", "Post-Workout"]
  }
];

export default function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(""));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSelect = (option: string) => {
    const newAnswers = [...answers];
    newAnswers[step] = option;
    setAnswers(newAnswers);
  };

  const handleNext = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      // Submit
      setLoading(true);
      try {
        const data = await api.submitOnboarding(answers);
        setResult(data);
        localStorage.setItem('sipsnaps:onboardingAnswers', JSON.stringify(answers));
        localStorage.setItem('sipsnaps:favoriteCard', JSON.stringify(data));
      } catch (e) {
        console.error(e);
        // Fallback mock
        const fallback = {
          name: "Signature Brown Sugar Boba",
          description: "Based on your sweet tooth and love for chewy textures, this is your soul mate.",
          image_url: ""
        };
        setResult(fallback);
        localStorage.setItem('sipsnaps:onboardingAnswers', JSON.stringify(answers));
        localStorage.setItem('sipsnaps:favoriteCard', JSON.stringify(fallback));
      } finally {
        setLoading(false);
      }
    }
  };

  if (result) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="h-full flex flex-col items-center justify-center p-6 text-center space-y-8"
      >
        <div className="space-y-2">
          <Sparkles className="w-12 h-12 text-yellow-400 mx-auto animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-900">Your Soul Mate Drink</h2>
          <p className="text-gray-500">AI has found the perfect match for you.</p>
        </div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-xl border border-gray-100"
        >
          <div className="aspect-square bg-gray-100 rounded-2xl mb-4 overflow-hidden flex items-center justify-center text-4xl">
            {result.image_url ? <img src={result.image_url} className="w-full h-full object-cover" /> : "🧋"}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{result.name}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{result.description}</p>
        </motion.div>

        <button 
          onClick={() => {
            localStorage.setItem('sipsnaps:onboarded', '1');
            onComplete();
          }}
          className="w-full max-w-xs bg-black text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:scale-105 transition-transform"
        >
          Start Exploring
        </button>
      </motion.div>
    );
  }

  const currentQuestion = questions[step];

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
            onClick={() => step > 0 && setStep(step - 1)} 
            className={`p-2 rounded-full hover:bg-gray-100 ${step === 0 ? 'invisible' : ''}`}
        >
            ←
        </button>
        <div className="flex gap-2">
            {questions.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= step ? 'bg-black' : 'bg-gray-200'}`} />
            ))}
        </div>
        <div className="w-8" />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <motion.div
            key={step}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-6"
        >
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {currentQuestion.question}
            </h2>
            
            <div className="flex flex-wrap gap-3">
                {currentQuestion.options.map((option) => (
                    <button
                        key={option}
                        onClick={() => handleSelect(option)}
                        className={`px-5 py-3 rounded-full text-sm font-medium transition-all ${
                            answers[step] === option 
                            ? 'bg-black text-white shadow-md scale-105' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {option}
                    </button>
                ))}
            </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6">
        <button
            onClick={handleNext}
            disabled={!answers[step] || loading}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                !answers[step] || loading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-black text-white shadow-lg hover:scale-[1.02]'
            }`}
        >
            {loading ? (
                <span className="animate-spin">⏳</span>
            ) : step === questions.length - 1 ? (
                <>Reveal My Drink <Sparkles size={20} /></>
            ) : (
                <>Next <ArrowRight size={20} /></>
            )}
        </button>
      </div>
    </div>
  );
}
