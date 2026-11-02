use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Default)]
pub struct Lifecycle {
    stopping: AtomicBool,
    starting: AtomicBool,
}
impl Lifecycle {
    pub fn stop(&self) {
        self.stopping.store(true, Ordering::SeqCst);
    }
    pub fn is_stopping(&self) -> bool {
        self.stopping.load(Ordering::SeqCst)
    }
    pub fn begin(&self) -> Result<(), &'static str> {
        if self.is_stopping() {
            return Err("application is closing");
        }
        self.starting
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| "startup already in progress")?;
        if self.is_stopping() {
            self.finish();
            return Err("application is closing");
        }
        Ok(())
    }
    pub fn finish(&self) {
        self.starting.store(false, Ordering::SeqCst);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closing_prevents_startup() {
        let flow = Lifecycle::default();
        flow.stop();
        assert!(flow.begin().is_err());
    }
    #[test]
    fn closing_during_startup_is_not_reset_by_completion() {
        let flow = Lifecycle::default();
        flow.begin().unwrap();
        flow.stop();
        flow.finish();
        assert!(flow.is_stopping());
        assert!(flow.begin().is_err());
    }
    #[test]
    fn duplicate_choices_are_rejected_but_cancelled_picker_can_retry() {
        let flow = Lifecycle::default();
        flow.begin().unwrap();
        assert!(flow.begin().is_err());
        flow.finish();
        assert!(flow.begin().is_ok());
    }
}
