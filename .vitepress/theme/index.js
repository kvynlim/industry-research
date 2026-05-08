import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import NotFound from './NotFound.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'not-found': () => h(NotFound)
    })
  }
}
