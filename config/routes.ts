/**
 * @name 路由配置
 * @description OpenGNB GUI 的路由配置，基于 opengnb 功能模块设计
 */
export default [
  {
    path: '/dashboard',
    name: '仪表盘',
    icon: 'dashboard',
    component: './Dashboard',
  },
  {
    path: '/node',
    name: '节点管理',
    icon: 'cluster',
    routes: [
      {
        path: '/node',
        redirect: '/node/list',
      },
      {
        name: '节点列表',
        icon: 'unorderedList',
        path: '/node/list',
        component: './NodeManage',
      },
      {
        name: '快速配置',
        icon: 'thunderbolt',
        path: '/node/quick-start',
        component: './NodeManage/QuickStart',
      },
      {
        name: '专业配置',
        icon: 'safety',
        path: '/node/safe-config',
        component: './SafeConfig',
      },
    ],
  },
  {
    path: '/logs',
    name: '日志查看',
    icon: 'fileText',
    component: './Logs',
  },
  {
    path: '/index-node',
    name: 'Index节点',
    icon: 'global',
    component: './IndexNode',
  },
  {
    path: '/settings',
    name: '系统设置',
    icon: 'setting',
    component: './Settings',
  },
  {
    path: '/about',
    name: '版本信息',
    icon: 'infoCircle',
    component: './About',
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    component: './Exception/404',
    path: '/*',
  },
];
