# OrbitQ Explorer

## 🚀📐

An experimental project to visualise real rocket launch vehicle data ([ll2 API](https://ll.thespacedevs.com/docs)). With emphasis on the visualise part.

> Work in progress — may break often

**[→ Live preview](https://orbitq-explorer-production-vue.up.railway.app/)**

Pick two rockets, get a side-by-side canvas with silhouettes drawn to real proportions. (Currently Janky) settings panel lets you apply thrust or show rocket stages (Starship only, currently).

### Current data points

- Vehicle scale
- Vehicle thrust

### Built with

- Rocket [SVGs](https://developer.mozilla.org/en-US/docs/Web/SVG) parsed into [Konva.js](https://konvajs.org) for canvas rendering
- [XState](https://stately.ai/docs/xstate) for animation control
- [Vue](https://vuejs.org) (React version later)

---

![](https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnd6OGM3MHFhczhlNW94MjhiMWhxcm9qYmJjbmtldzdwcHN5OTNzciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/sUl6rKwdqjd1C/giphy.gif)
