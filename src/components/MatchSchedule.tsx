import { useState, useEffect } from 'react';
import { Calendar, Trophy } from 'lucide-react';

const API_URL = 'http://localhost:3001';

interface Match {
  id: string;
  team1: { name: string };
  team2: { name: string };
  team3: { name: string };
  team4: { name: string };
  score1: number | null;
  score2: number | null;
}

export default function MatchSchedule() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scoreInputs, setScoreInputs] = useState<{ [key: string]: { score1: string; score2: string } }>({});

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/matches`);
      const data = await response.json();
      setMatches(data);
    } catch (err) {
      setError('Failed to fetch matches');
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleGenerateSchedule = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/generate-schedule`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate schedule');
      }

      await fetchMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (matchId: string, field: 'score1' | 'score2', value: string) => {
    setScoreInputs((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value,
      },
    }));
  };

  const handleSubmitScore = async (matchId: string) => {
    const scores = scoreInputs[matchId];
    if (!scores || scores.score1 === '' || scores.score2 === '') {
      setError('Please enter both scores');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score1: parseInt(scores.score1),
          score2: parseInt(scores.score2),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update score');
      }

      await fetchMatches();
      setScoreInputs((prev) => {
        const newInputs = { ...prev };
        delete newInputs[matchId];
        return newInputs;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update score');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Match Schedule</h2>
        </div>
        <button
          onClick={handleGenerateSchedule}
          disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Schedule'}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Match
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Alliance 1
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                Score
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Alliance 2
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                Score
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {matches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No matches scheduled yet
                </td>
              </tr>
            ) : (
              matches.map((match, index) => (
                <tr key={match.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">#{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-blue-600 font-medium">{match.team1.name}</div>
                      <div className="text-blue-600 font-medium">{match.team2.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {match.score1 !== null ? (
                      <span className="text-lg font-bold text-gray-800">{match.score1}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={scoreInputs[match.id]?.score1 || ''}
                        onChange={(e) => handleScoreChange(match.id, 'score1', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-red-600 font-medium">{match.team3.name}</div>
                      <div className="text-red-600 font-medium">{match.team4.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {match.score2 !== null ? (
                      <span className="text-lg font-bold text-gray-800">{match.score2}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={scoreInputs[match.id]?.score2 || ''}
                        onChange={(e) => handleScoreChange(match.id, 'score2', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {match.score1 === null && match.score2 === null ? (
                      <button
                        onClick={() => handleSubmitScore(match.id)}
                        className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Submit
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-green-600">
                        <Trophy className="w-4 h-4" />
                        <span className="text-xs font-medium">Complete</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        Total Matches: <span className="font-semibold">{matches.length}</span>
      </p>
    </div>
  );
}
