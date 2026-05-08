<script setup>
import { withBase } from 'vitepress'

const links = [
  { href: withBase('/'), text: 'Home' },
  { href: withBase('/INDEX/'), text: 'Research Index' },
  { href: withBase('/synthesis/master-synthesis'), text: 'Master Synthesis' },
  { href: withBase('/GLOSSARY'), text: 'Glossary' }
]
</script>

<template>
  <main class="research-not-found">
    <p class="research-not-found__eyebrow">404</p>
    <h1>Page not found</h1>
    <p>
      The document may have moved or the link may be stale. Use the search box in the top
      navigation, or jump back into one of the main research entry points.
    </p>
    <div class="research-not-found__links">
      <a v-for="link in links" :key="link.href" :href="link.href">
        {{ link.text }}
      </a>
    </div>
  </main>
</template>
