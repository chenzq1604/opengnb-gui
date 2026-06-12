; 卸载时删除残留数据
; customUnInstall 在所有安装文件删除后执行
; 需要清理：
; 1. 安装目录下的用户数据（$INSTDIR\resources\bin\safe\conf 等）
; 2. 用户 APPDATA 目录下的 GUI 数据（%APPDATA%\opengnb-gui）
; 3. 安装目录本身（如果非空导致未自动删除）
!macro customUnInstall
  ; 检查是否有残留数据需要清理
  ExpandEnvStrings $R0 "%APPDATA%"
  StrCpy $R1 "0"
  ; 检查 safe 配置
  IfFileExists "$INSTDIR\resources\bin\safe\conf\*.*" hasSafeConf checkAppData
  hasSafeConf:
    StrCpy $R1 "1"
    Goto askUser
  checkAppData:
    IfFileExists "$R0\opengnb-gui\*.*" hasAppData noData
    hasAppData:
      StrCpy $R1 "1"
      Goto askUser
  noData:
    ; 检查安装目录是否还存在（非空）
    IfFileExists "$INSTDIR\*.*" checkInstDir noAction
    checkInstDir:
      ; 安装目录还存在说明有残留文件，直接删除
      RMDir /r "$INSTDIR"
      DetailPrint "Removed leftover installation directory: $INSTDIR"
    noAction:
      Goto unEnd
  askUser:
    MessageBox MB_YESNO|MB_ICONQUESTION "Delete OpenGNB configuration and app data?$\n  - Configs and keys in: $INSTDIR$\n  - App data in: $R0\opengnb-gui" IDYES delAllData IDNO keepData
    delAllData:
      ; 删除 APPDATA
      RMDir /r "$R0\opengnb-gui"
      DetailPrint "Deleted app data from $R0\opengnb-gui"
      ; 删除整个安装目录（包括残留的用户数据）
      RMDir /r "$INSTDIR"
      DetailPrint "Deleted installation directory: $INSTDIR"
      Goto unEnd
    keepData:
      DetailPrint "Keeping app data"
      ; 即使保留数据，也尝试清理空安装目录
      RMDir "$INSTDIR"
      RMDir "$INSTDIR\resources"
      RMDir "$INSTDIR\resources\bin"
      RMDir "$INSTDIR\resources\bin\safe"
      RMDir "$INSTDIR\resources\bin\safe\conf"
  unEnd:
!macroend
