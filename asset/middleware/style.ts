import * as root from '../essential';
var rootRequest=root.request,
    rootUtility=root.utility,

    rootSetting=root.configuration.setting,
    rootDirectory=root.configuration.directory,

    rootObject=rootUtility.objects,
    rootArray=rootUtility.arrays,
    rootValidate=rootUtility.check;

export class middleware {
  constructor(private core?:any) {
  }
  register() {
  }
}