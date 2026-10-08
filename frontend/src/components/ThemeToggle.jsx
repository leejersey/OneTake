/**
 * 主题切换按钮组件
 */
import { useTheme } from '../contexts/theme';

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={styles.button}
      title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

const styles = {
  button: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.1)',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
};

export default ThemeToggle;
