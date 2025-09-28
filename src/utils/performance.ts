// Performance monitoring utilities for React Native app
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();
  private static metrics: Map<string, number[]> = new Map();

  static startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  static endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    // Store metric for analysis
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    if (__DEV__) {
      console.log(`⚡ Performance: ${label} took ${duration}ms`);
    }

    return duration;
  }

  static getAverageTime(label: string): number {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) return 0;

    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  static logSummary(): void {
    if (!__DEV__) return;

    console.log('\n📊 Performance Summary:');
    this.metrics.forEach((times, label) => {
      const avg = this.getAverageTime(label);
      const min = Math.min(...times);
      const max = Math.max(...times);
      console.log(`  ${label}: avg ${avg.toFixed(1)}ms (min: ${min}ms, max: ${max}ms, samples: ${times.length})`);
    });
  }

  static clearMetrics(): void {
    this.metrics.clear();
    this.timers.clear();
  }
}

// Hook for measuring component render time
export const usePerfTimer = (componentName: string) => {
  const startTime = Date.now();
  
  return () => {
    const renderTime = Date.now() - startTime;
    if (__DEV__ && renderTime > 16) { // Only log if > 1 frame (16ms)
      console.log(`🐌 Slow render: ${componentName} took ${renderTime}ms`);
    }
  };
};

// Debounce utility for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};


