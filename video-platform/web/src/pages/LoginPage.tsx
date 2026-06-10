import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Eye, EyeOff, Leaf, LogIn, UserPlus } from 'lucide-react';

const mockLogin = (username: string, password: string) => {
  localStorage.setItem('token', 'mock_jwt_token');
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: username }));
  return { success: true };
};

const mockRegister = (username: string, email: string, password: string) => {
  localStorage.setItem('token', 'mock_jwt_token');
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: username, email }));
  return { success: true };
};

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<FormErrors>({});

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regErrors, setRegErrors] = useState<FormErrors>({});

  // Password visibility
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  const validateUsername = (name: string): string | undefined => {
    if (!name.trim()) return '请输入用户名';
    if (name.trim().length < 2) return '用户名至少2个字符';
    if (name.trim().length > 20) return '用户名最多20个字符';
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return '请输入邮箱';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return '邮箱格式不正确';
    return undefined;
  };

  const validatePassword = (pwd: string): string | undefined => {
    if (!pwd) return '请输入密码';
    if (pwd.length < 6) return '密码至少6位';
    return undefined;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FormErrors = {};
    errors.username = validateUsername(loginUsername);
    errors.password = validatePassword(loginPassword);

    const filteredErrors: FormErrors = {};
    if (errors.username) filteredErrors.username = errors.username;
    if (errors.password) filteredErrors.password = errors.password;
    setLoginErrors(filteredErrors);

    if (!errors.username && !errors.password) {
      mockLogin(loginUsername, loginPassword);
      toast.success('登录成功！');
      navigate('/');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FormErrors = {};
    errors.username = validateUsername(regUsername);
    errors.email = validateEmail(regEmail);
    errors.password = validatePassword(regPassword);
    if (regPassword !== regConfirm) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    const filteredErrors: FormErrors = {};
    if (errors.username) filteredErrors.username = errors.username;
    if (errors.email) filteredErrors.email = errors.email;
    if (errors.password) filteredErrors.password = errors.password;
    if (errors.confirmPassword) filteredErrors.confirmPassword = errors.confirmPassword;
    setRegErrors(filteredErrors);

    if (
      !errors.username &&
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword
    ) {
      mockRegister(regUsername, regEmail, regPassword);
      toast.success('注册成功！');
      navigate('/');
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8 bg-gradient-to-br from-pink-50 via-white to-pink-50">
      <div className="w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#CD5700] text-white mb-4 shadow-lg shadow-pink-200">
            <Leaf className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'login' ? '登录 Sukačev' : '注册 Sukačev'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">发现精彩视频，分享创意生活</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-pink-100/50 border border-pink-100 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'login' | 'register')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-gray-50 h-12 p-0">
              <TabsTrigger
                value="login"
                className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#CD5700] data-[state=active]:text-[#b84d00] text-gray-500"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                登录
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#CD5700] data-[state=active]:text-[#b84d00] text-gray-500"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />
                注册
              </TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="p-6 pt-5 m-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">用户名</Label>
                  <Input
                    id="login-username"
                    placeholder="请输入用户名"
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      if (loginErrors.username) setLoginErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    aria-invalid={!!loginErrors.username}
                    className="h-11"
                    autoComplete="username"
                  />
                  {loginErrors.username && (
                    <p className="text-xs text-red-500 mt-1">{loginErrors.username}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPwd ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginErrors.password) setLoginErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      aria-invalid={!!loginErrors.password}
                      className="h-11 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPwd(!showLoginPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginErrors.password && (
                    <p className="text-xs text-red-500 mt-1">{loginErrors.password}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#CD5700] hover:bg-[#b84d00] text-white font-medium text-base mt-2 rounded-xl shadow-md shadow-pink-200 transition-all"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-3">
                  点击登录即表示您同意我们的服务条款
                </p>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="p-6 pt-5 m-0">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">用户名</Label>
                  <Input
                    id="reg-username"
                    placeholder="2-20个字符"
                    value={regUsername}
                    onChange={(e) => {
                      setRegUsername(e.target.value);
                      if (regErrors.username) setRegErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    aria-invalid={!!regErrors.username}
                    className="h-11"
                    autoComplete="username"
                  />
                  {regErrors.username && (
                    <p className="text-xs text-red-500 mt-1">{regErrors.username}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email">邮箱</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="example@email.com"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      if (regErrors.email) setRegErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    aria-invalid={!!regErrors.email}
                    className="h-11"
                    autoComplete="email"
                  />
                  {regErrors.email && (
                    <p className="text-xs text-red-500 mt-1">{regErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showRegPwd ? 'text' : 'password'}
                      placeholder="至少6位"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (regErrors.password) setRegErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      aria-invalid={!!regErrors.password}
                      className="h-11 pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPwd(!showRegPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regErrors.password && (
                    <p className="text-xs text-red-500 mt-1">{regErrors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">确认密码</Label>
                  <div className="relative">
                    <Input
                      id="reg-confirm"
                      type={showRegConfirm ? 'text' : 'password'}
                      placeholder="再次输入密码"
                      value={regConfirm}
                      onChange={(e) => {
                        setRegConfirm(e.target.value);
                        if (regErrors.confirmPassword)
                          setRegErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }}
                      aria-invalid={!!regErrors.confirmPassword}
                      className="h-11 pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirm(!showRegConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regErrors.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">{regErrors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#CD5700] hover:bg-[#b84d00] text-white font-medium text-base mt-2 rounded-xl shadow-md shadow-pink-200 transition-all"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  注册
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-3">
                  点击注册即表示您同意我们的服务条款和隐私政策
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6 text-sm text-muted-foreground">
          <button
            onClick={() => navigate('/')}
            className="text-[#CD5700] hover:text-[#b84d00] hover:underline transition-colors"
          >
            返回首页
          </button>
        </p>
      </div>
    </div>
  );
}
