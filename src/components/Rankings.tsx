import { useState, useEffect } from 'react';
import { Trophy, Medal } from 'lucide-react';

const API_URL = 'http://localhost:3001';

interface Ranking {
  team_id: string;
  team_name: string;
  matches_played: number;
  total_rp: number;
  average_rp: string;
}

export default function Rankings() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/rankings`);
      const data = await response.json();
      setRankings(data);
    } catch (err) {
      setError('Failed to fetch rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
    const interval = setInterval(fetchRankings, 3000);
    return () => clearInterval(interval);
  }, []);

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Medal className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-600" />;
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-800">Rankings</h2>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading && rankings.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Loading rankings...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Team
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  Matches
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  Total RP
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  Avg RP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rankings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No rankings available yet
                  </td>
                </tr>
              ) : (
                rankings.map((ranking, index) => (
                  <tr
                    key={ranking.team_id}
                    className={`hover:bg-gray-50 ${
                      index < 3 ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getMedalIcon(index + 1)}
                        <span className="font-bold text-gray-800">
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {ranking.team_name}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {ranking.matches_played}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">
                      {ranking.total_rp}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
                        {ranking.average_rp}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Scoring System:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>Win: 3 Ranking Points (RP)</li>
          <li>Draw: 1 Ranking Point (RP)</li>
          <li>Loss: 0 Ranking Points</li>
          <li>Rankings are sorted by Average RP (Total RP / Matches Played)</li>
        </ul>
      </div>
    </div>
  );
}
