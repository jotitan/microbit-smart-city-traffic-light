basic.forever(function () {
	
})


class Light {
    constructor(public state:Kitronik_STOPbit.LightStates = Kitronik_STOPbit.LightStates.Stop){
        this.show();
    }
    show(){
        Kitronik_STOPbit.trafficLightState(this.state);
        switch(this.state){
            case Kitronik_STOPbit.LightStates.Go:basic.showArrow(2);break;
            case Kitronik_STOPbit.LightStates.Stop: basic.showIcon(IconNames.Square);break;
            case Kitronik_STOPbit.LightStates.GetReady: basic.showIcon(IconNames.Chessboard); break;
        }
    }
    start(){
        this.state = Kitronik_STOPbit.LightStates.Go;
        this.show();
    }
    stop(){
        if (this.state === Kitronik_STOPbit.LightStates.Stop){
            return;
        }
        this.state = Kitronik_STOPbit.LightStates.GetReady;
        this.show();
        basic.pause(1500)
        this.state = Kitronik_STOPbit.LightStates.Stop;
        this.show();
    }
}

enum CrossRoadKind {Line, Cross, T}
enum CrossRoadPosition {A, B, C, D}

function getCrossRoadPosition(position:string):CrossRoadPosition {
    switch (position) {
        case 'A':
        case '0': return CrossRoadPosition.A;
        case 'B':
        case '1': return CrossRoadPosition.B;
        case 'C':
        case '2': return CrossRoadPosition.C;
        case 'D':
        case '3': return CrossRoadPosition.D;
        default: return CrossRoadPosition.A;
    }
}

class Fire{
    constructor(private id:number,private position:CrossRoadPosition){}
    equals(f:Fire):boolean{
        return f.id === this.id;
    }
}

class LightManager{
    transmit: RadioTransmit
    receiver: RadioReceiver
    light:Light
    id:number
    fires:Fire[] = []
    waitAccess:boolean = false
    state: Kitronik_STOPbit.LightStates = Kitronik_STOPbit.LightStates.Stop
    constructor(public group: number, public crossRoadKind: CrossRoadKind, public position: CrossRoadPosition){
        this.transmit = new RadioTransmit(this);
        this.receiver = new RadioReceiver(this);
        this.light = new Light();
        this.id = randint(0,1000)
        input.onButtonPressed(Button.A,()=>this.askAccess())
        this.transmit.hello();
    }
    askAccess(){
        if(this.light.state === Kitronik_STOPbit.LightStates.Go){
            return;
        }
        this.waitAccess = true;
        this.transmit.askAccess()
    }
    notifyHello(id:number, position:CrossRoadPosition){
        // store every player id with position
        if(!this.fires.some(f=>f.equals(new Fire(id, position)))){
            this.fires.push(new Fire(id, position))
            // Say hello again
            this.transmit.hello()
            basic.showNumber(this.fires.length)
        }
    }
    canPass(){
        if(this.light.state !== Kitronik_STOPbit.LightStates.Stop || !this.waitAccess){
            return;
        }
        
        // Check if enough answer is received
        this.waitAccess = false;
        this.light.start();
    }
    receiveAskAccess(id:number, position:CrossRoadPosition){
        if(position === this.position){
            return;
        }
        if(this.light.state === Kitronik_STOPbit.LightStates.Stop){
            // Already stop
            return this.transmit.sayStopped()            
        }
        this.transmit.sayGonnaStop();
        this.launchStop();
    }
    launchStop(){
        this.light.stop();
        pause(1000);
        this.transmit.sayStopped();
    }
}

enum Event {
    HELLO = 0,
    ASK_ACCESS = 1,
    STOPPED = 2,
    TO_STOP = 3

}

// Send messages to all
class RadioTransmit{
    constructor(private manager: LightManager){
        radio.setGroup(manager.group)
        radio.setFrequencyBand(manager.group)
    }
    send(event:Event) {
        radio.sendString(`${event}:${this.manager.id}:${this.manager.group}:${this.manager.position}`)
    }
    askAccess(){
        this.send(Event.ASK_ACCESS);
    }
    sayStopped(){
        this.send(Event.STOPPED);
    }
    sayGonnaStop(){
        this.send(Event.TO_STOP);
    }
    hello(){
        this.send(Event.HELLO);
    }
}

class RadioReceiver{
    constructor(private manager: LightManager) { 
        radio.onReceivedString(message=>{
            console.log(`Received ${message}`)
            const event = parseInt(message.split(":")[0]);
            const id = parseInt(message.split(":")[1]);
            const group = parseInt(message.split(":")[2]);
            const position = message.split(":")[3];
            this.manage(event, id, group, getCrossRoadPosition(position))
        })   
    }
    manage(event:number, id:number, group:number, position:CrossRoadPosition){
        if(group !== this.manager.group){
            return; // Ignore other group
        }
        switch(event){
            case Event.ASK_ACCESS:this.manager.receiveAskAccess(id, position);break;
            case Event.TO_STOP:break;
            case Event.STOPPED:this.manager.canPass();break;
            case Event.HELLO:this.manager.notifyHello(id, position);break;
        }
    }
}

/* Configuration */
class Configuration{
    constructor(private group: number = 0, private crossRoadKind: CrossRoadKind = CrossRoadKind.Line){
        new GroupConfig((group:number)=>this.showCrossroadTypeConfig(group));
    }
    showCrossroadTypeConfig(group:number){
        this.group = group;
        new KindConfig((kind: CrossRoadKind)=>this.showCrossroadPosition(kind));
    }
    showCrossroadPosition(kind: CrossRoadKind){
        this.crossRoadKind = kind;
        new PositionConfig((position: CrossRoadPosition) => this.complete(position),'A')
    }
    complete(position: CrossRoadPosition){
        new LightManager(this.group, this.crossRoadKind, position)
    }
}

// Choose group crossroad, crossroad type, then position
class GroupConfig {
    constructor(next:(group:number)=>void,private group:number = 0){
        input.onButtonPressed(Button.A, () => this.increaseGroupNumber());
        input.onButtonPressed(Button.B, ()=>next(this.group));
        this.show();
    }
    increaseGroupNumber(){
        this.group = (this.group + 1)%10;
        this.show();
    }
    show(){
        basic.showNumber(this.group)
    }
}

// Choose group crossroad, crossroad type, then position
class PositionConfig {
    positions:string[] = ['A','B','C','D']
    constructor(next: (position: CrossRoadPosition) => void, private position: string) {
        input.onButtonPressed(Button.A, () => this.increasePosition());
        input.onButtonPressed(Button.B, () => next(getCrossRoadPosition(this.position)));
        this.show();
    }
    increasePosition() {
        const pos = this.positions.indexOf(this.position);
        this.position = this.positions[(pos+1)%4];
        this.show();
    }
    show() {
        basic.showString(this.position)
    }
}

class KindConfig {
    constructor(next: (kind:CrossRoadKind) => void, private kind: CrossRoadKind = CrossRoadKind.Line) {
        input.onButtonPressed(Button.A, () => this.increaseType());
        input.onButtonPressed(Button.B, () => next(this.kind));
        this.show();
    }
    increaseType(){
        switch (this.kind) {
            case CrossRoadKind.Line: this.kind = CrossRoadKind.Cross;break;
            case CrossRoadKind.Cross: this.kind = CrossRoadKind.T; break;
            case CrossRoadKind.T: this.kind = CrossRoadKind.Line;break;
        }
        this.show();
    }
    show(){
        switch(this.kind){
            case CrossRoadKind.Line:basic.showArrow(2);break;
            case CrossRoadKind.Cross: basic.showIcon(3);break;
            case CrossRoadKind.T: basic.showString("T");break;
        }
    }
}
new Configuration();
