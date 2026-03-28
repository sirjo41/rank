import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Gavel, Monitor, Scale } from 'lucide-react';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const roles = [
    {
      id: 'admin',
      title: 'Admin',
      description: 'Manage teams, schedule, approve scores, and control the audience display',
      icon: <Shield className="w-12 h-12" />,
      color: 'from-violet-600 to-purple-700',
      glow: 'rgba(139, 92, 246, 0.3)',
      requiresAuth: true,
    },
    {
      id: 'judge',
      title: 'Judge',
      description: 'Enter scores & fouls for your alliance and mark ready for match start',
      icon: <Gavel className="w-12 h-12" />,
      color: 'from-amber-500 to-orange-600',
      glow: 'rgba(245, 158, 11, 0.3)',
      requiresAuth: true,
    },
    {
      id: 'referee',
      title: 'Head Referee',
      description: 'Start the match timer, run auto → pickup → teleop, and pause or restart the clock',
      icon: <Scale className="w-12 h-12" />,
      color: 'from-rose-600 to-red-800',
      glow: 'rgba(244, 63, 94, 0.3)',
      requiresAuth: true,
    },
    {
      id: 'audience',
      title: 'Audience',
      description: 'View live matches, scores, and rankings on the big screen',
      icon: <Monitor className="w-12 h-12" />,
      color: 'from-emerald-500 to-teal-600',
      glow: 'rgba(16, 185, 129, 0.3)',
      requiresAuth: false,
    },
  ];

  const handleSelect = (roleId: string, requiresAuth: boolean) => {
    if (requiresAuth && !user) {
      navigate(`/login?redirect=${roleId}`);
    } else {
      navigate(`/${roleId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #020617, #0a0e1a, #111827)' }}>

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Logo & Title */}
      <div className="relative z-10 text-center mb-16 animate-fadeIn">
        <div className="text-7xl mb-6">🤖</div>
        <h1 className="text-5xl md:text-6xl font-black tracking-wider gradient-text mb-4"
          style={{ fontFamily: "'Orbitron', sans-serif" }}>
          UniBotics
        </h1>
        <p className="text-gray-400 text-lg tracking-widest uppercase">
          Competition Management System
        </p>
      </div>

      {/* Role Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-6xl w-full">
        {roles.map((role, index) => (
          <button
            key={role.id}
            onClick={() => handleSelect(role.id, role.requiresAuth)}
            className="group glass-card p-8 text-left transition-all duration-500 hover:scale-105"
            style={{
              animationDelay: `${index * 0.15}s`,
              animation: 'fadeIn 0.6s ease-out forwards',
              opacity: 0,
            }}
          >
            <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${role.color} mb-6
              group-hover:shadow-lg transition-all duration-500`}
              style={{ boxShadow: `0 0 0px ${role.glow}` }}
            >
              {role.icon}
            </div>
            <h2 className="text-2xl font-bold mb-3 tracking-wide"
              style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {role.title}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              {role.description}
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
              {role.requiresAuth ? (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Login Required</span>
                </>
              ) : (
                <span>Open Access →</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-16 text-center">
        <p className="text-gray-600 text-xs tracking-wider uppercase">
          FRC / FTC Style Competition Platform
        </p>
      </div>
    </div>
  );
}
