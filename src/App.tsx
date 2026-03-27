import { useState } from 'react';
import TeamManagement from './components/TeamManagement';
import MatchSchedule from './components/MatchSchedule';
import Rankings from './components/Rankings';
import { Cpu } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'teams' | 'matches' | 'rankings'>('teams');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Robotics Competition Manager
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                2v2 Competition Management System
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('teams')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'teams'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'matches'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Matches
            </button>
            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'rankings'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Rankings
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {activeTab === 'teams' && <TeamManagement />}
          {activeTab === 'matches' && <MatchSchedule />}
          {activeTab === 'rankings' && <Rankings />}
        </div>
      </div>
    </div>
  );
}

export default App;
